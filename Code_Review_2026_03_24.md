# CamNet 코드 리뷰

**날짜**: 2026-03-24
**리뷰어**: Claude Code (claude-sonnet-4-6)

---

## 리뷰 범위

| 레이어 | 주요 파일 |
|--------|-----------|
| Backend | `main.py`, `cameras.py`, `polling.py`, `ws_manager.py`, `database.py`, `schemas/camera.py`, `models/camera.py` |
| Frontend | `App.jsx`, `api.js`, `utils.js` |
| Infra | `nginx/default.conf`, `docker-compose.yml` |

---

## 강점

- **비동기 설계**: `httpx.AsyncClient` + `asyncio.gather`로 카메라 병렬 폴링, 블로킹 없음
- **상태 변경 시에만 브로드캐스트**: `_status_cache` 비교로 불필요한 WS 트래픽 억제
- **Pydantic `exclude=True`**: `api_password`가 응답에서 자동 제거 (`schemas/camera.py:52`)
- **2단계 헬스체크**: MediaMTX API 실패 시 WebRTC 포트로 fallback
- **WebSocket 지수 백오프 재연결**: `api.js` 구현이 깔끔함
- **`camerasRef`**: stale closure 방지 패턴이 올바르게 적용됨

---

## 필수 수정 사항

### [blocking] SSRF — Nginx HLS 프록시에 IP 검증 없음

**파일**: `nginx/default.conf:34-41`

```nginx
location ~ ^/hls/(?<cam_ip>[0-9.]+)/(?<cam_port>[0-9]+)/(?<cam_path>.*)$ {
    proxy_pass http://$cam_ip:$cam_port/$cam_path$is_args$args;
```

URL의 `cam_ip`와 `cam_port`를 그대로 내부 프록시로 사용합니다. 공격자가 `/hls/127.0.0.1/9997/v3/paths/list/`를 요청하면 **컨테이너 내부 MediaMTX API에 직접 접근 가능**합니다. 클라우드 환경이라면 `/hls/169.254.169.254/80/latest/meta-data/`로 메타데이터 서버에도 접근됩니다.

**보완 방향**: 허용 IP 대역(`allow` 지시어) 또는 허용 포트 목록 제한, 혹은 카메라 IP를 백엔드에서 조회하여 프록시하는 API 엔드포인트로 전환 검토.

---

### [blocking] `check_single`의 3-세션 분리 — 레이스 컨디션

**파일**: `backend/app/services/polling.py:148-166`

```python
async def check_single(self, camera_id: str) -> CameraStatus:
    async with AsyncSessionLocal() as db:          # 세션 1: 카메라 조회
        cam = await db.get(Camera, camera_id)
        if not cam:
            raise ValueError(...)
    # 세션 1 닫힘 — cam 객체는 detached 상태

    async with httpx.AsyncClient(...) as client:   # HTTP 요청
        status, last_seen = await self._check_camera(client, cam)  # detached 객체 사용

    async with AsyncSessionLocal() as db:          # 세션 2: DB 업데이트
        db_cam = await db.get(Camera, camera_id)   # 재조회
        ...
```

세션 1이 닫힌 후 `cam`은 detached 상태입니다. `_check_camera`에서 `cam.ip`, `cam.port` 등을 접근할 때 lazy load가 발생하면 `DetachedInstanceError`가 날 수 있습니다 (현재는 eager load이므로 당장은 동작하지만 취약한 구조). 또한 세션 1~2 사이에 카메라가 삭제되면 `db_cam`이 `None`이 되어 업데이트가 무시됩니다.

추가로 `check_single`은 `_status_cache`를 갱신하지 않습니다. 이로 인해 다음 폴링 주기에 **상태가 바뀐 것처럼 감지되어 불필요한 WS 브로드캐스트**가 발생합니다.

---

### [blocking] WebSocket에 인증 없음

**파일**: `backend/app/api/ws.py` (전체)

`/ws` 엔드포인트는 누구든 연결할 수 있습니다. 연결 즉시 전체 카메라 목록(IP 주소, 경로, 상태 포함)이 스냅샷으로 전송됩니다. 내부망 전용이라면 Nginx 레벨에서 접근 제한이라도 설정해야 합니다.

---

## 중요 수정 사항

### [important] 카메라 IP 입력값 검증 없음

**파일**: `backend/app/schemas/camera.py:9`

```python
ip: str   # 검증 없음
```

`ip` 필드가 순수 문자열이라 `localhost`, `127.0.0.1`, `169.254.169.254` 같은 내부 주소를 등록할 수 있습니다. 폴링 서비스가 이 IP로 HTTP 요청을 보내는 구조이므로 SSRF의 또 다른 경로가 됩니다.

**제안**: Pydantic의 `IPvAnyAddress` 타입 사용, 또는 `@field_validator`로 사설 IP 블록 차단.

---

### [important] 낙관적 UI 업데이트 — 실패 시 롤백 없음

**파일**: `frontend/src/App.jsx:75-82`

```js
const deleteCamera = useCallback(async (id) => {
  setCameras(prev => prev.filter(cam => cam.id !== id));  // 먼저 제거
  try {
    await api.deleteCamera(id);
  } catch (err) {
    console.error("[API] deleteCamera error", err);       // 롤백 없음!
  }
}, []);
```

API 호출이 실패해도 UI에서는 카메라가 사라집니다. 사용자가 새로고침 전까지 실제 상태를 알 수 없습니다. `updatePosition`도 동일한 문제입니다.

---

### [important] WS URL — HTTPS 환경에서 `ws://` 하드코딩

**파일**: `frontend/src/api.js:4`

```js
const WS_URL = `ws://${window.location.host}/ws`;
```

HTTPS로 서빙할 경우 브라우저가 mixed content로 차단합니다.

**수정 방향**:
```js
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
```

---

### [important] `CameraUpdate`에서 `status` 직접 수정 허용

**파일**: `backend/app/schemas/camera.py:43`

```python
class CameraUpdate(BaseModel):
    ...
    status: Optional[CameraStatus] = None  # 직접 수정 가능
```

클라이언트가 `PATCH /api/cameras/{id}`로 `status: "online"`을 전송하면 실제 카메라 상태와 무관하게 DB가 업데이트됩니다. 다음 폴링 주기에 덮어쓰이긴 하지만, 의도하지 않은 것이라면 제거하는 것이 명확합니다.

---

### [important] `_sqlite_add_missing_columns` — 테이블/컬럼명 SQL 인젝션

**파일**: `backend/app/core/database.py:62-64`

```python
conn.execute(text(
    f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}{default_clause}"
))
```

`table.name`과 `col.name`이 SQLAlchemy 모델 메타데이터에서 오므로 **현재는 안전**합니다. 하지만 미래에 외부 입력이 모델명에 개입할 가능성이 있고, 패턴 자체가 위험합니다. 정규식으로 `[A-Za-z0-9_]`만 허용하는 검증을 추가하는 것이 방어적입니다.

---

## 제안 사항

### [suggestion] `updateCamera` — 동시 요청 레이스 컨디션

**파일**: `frontend/src/App.jsx:58-63`

```js
const updateCamera = useCallback(async (id, updates) => {
  setCameras(prev => ...);  // 낙관적 업데이트
  const updated = await api.updateCamera(...);
  setCameras(prev => ...);  // 서버 응답으로 덮어쓰기
}, []);
```

빠르게 연속으로 호출하면 늦게 도착한 응답이 최신 상태를 덮어쓸 수 있습니다. `AbortController`로 이전 요청을 취소하거나, 요청 순서를 추적하는 `requestId`를 사용하는 방식을 고려할 수 있습니다.

---

### [suggestion] 매직 넘버 중복 — 타임아웃 5.0초

**파일**: `backend/app/services/polling.py:71, 155`

```python
async with httpx.AsyncClient(timeout=5.0, ...) as client:  # L71
...
async with httpx.AsyncClient(timeout=5.0, ...) as client:  # L155
```

`settings`에 `HTTP_TIMEOUT`으로 추출하면 환경별 조정이 가능합니다.

---

### [suggestion] URL 프로퍼티 이중 정의

**파일**: `backend/app/models/camera.py:41-55`, `backend/app/schemas/camera.py:55-68`

`webrtc_url`, `hls_url`, `rtsp_url`이 ORM 모델과 Pydantic 스키마 양쪽에 정의되어 있습니다. 로직이 달라지면 한쪽만 수정하는 실수가 생길 수 있습니다. ORM 모델의 프로퍼티를 제거하고 스키마에만 두거나, 유틸 함수로 추출하는 것이 좋습니다.

---

### [suggestion] `PositionUpdate`를 스키마 파일로 이동

**파일**: `backend/app/api/cameras.py:19-21`

```python
class PositionUpdate(BaseModel):  # 라우터 파일 내부에 정의됨
```

`schemas/camera.py`로 이동하면 일관성이 생깁니다.

---

## 학습 포인트

### [learning] `asyncio.gather(*tasks, return_exceptions=True)` 패턴

**파일**: `backend/app/services/polling.py:73`

`return_exceptions=True`를 사용하면 개별 태스크가 예외를 던져도 나머지 태스크가 계속 실행됩니다. 76-80번 라인에서 `isinstance(check_result, Exception)`으로 확인하는 방식이 교과서적인 처리입니다. 잘 된 부분입니다.

---

### [learning] `dead` 세트로 안전한 Set 수정

**파일**: `backend/app/core/ws_manager.py:32-39`

반복 중 Set을 직접 수정하면 `RuntimeError`가 발생합니다. `dead` 임시 세트에 모았다가 반복 후 제거하는 패턴이 올바릅니다.

---

## 테스트 관련

### [nit] `sample_camera_data`에 `hls_port` 누락

**파일**: `backend/tests/conftest.py:77-91`

`hls_port` 필드가 빠져 있습니다. 기본값(`8888`)이 있어서 테스트는 통과하지만, 픽스처가 완전한 데이터를 표현하지 않습니다.

### [learning] `_run_async` 헬퍼 패턴

`asyncio.new_event_loop()`를 매번 생성하는 방식은 테스트 격리에는 유효하지만, pytest-asyncio를 사용하면 이 헬퍼 없이 `async def test_...`를 직접 작성할 수 있어 더 깔끔합니다.

---

## 보안 체크리스트

| 항목 | 상태 |
|------|------|
| 사용자 입력 검증 (IP 주소) | ❌ 검증 없음 |
| SQL 파라미터화 (일반 쿼리) | ✅ SQLAlchemy ORM 사용 |
| API 인증/인가 | ❌ 없음 |
| 비밀번호 응답 제외 | ✅ `exclude=True` |
| CORS 설정 | ✅ 화이트리스트 |
| SSRF 방지 (Nginx 프록시) | ❌ IP 검증 없음 |
| SSRF 방지 (폴링 서비스) | ❌ 내부 IP 차단 없음 |
| HTTPS/WSS 지원 | ❌ ws:// 하드코딩 |
| 퍼블릭 엔드포인트 Rate Limiting | ❌ 없음 |

---

## 판정

> **Request Changes** — 내부망 전용으로 동작한다면 당장 심각한 문제는 아니지만, SSRF 취약점 2개(Nginx + 폴링 서비스)가 인터넷 노출 시 위험합니다. `check_single` 세션 분리 버그와 WS URL 문제는 기능 정확성에 영향을 줍니다. 위 Blocking 항목들을 수정한 후 머지를 권장합니다.
