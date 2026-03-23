# CamNET — IP Camera Management System

MediaMTX 기반 라즈베리파이 카메라를 통합 관리하는 웹 대시보드입니다.

## 시스템 구성

```
라즈베리파이 #1  (MediaMTX)  192.168.0.47
라즈베리파이 #2  (MediaMTX)  192.168.0.48
        ...
         ↕  WebRTC / RTSP / REST API
┌─────────────────────────────────┐
│  CamNET 서버 (Docker Compose)    │
│  ├── Nginx  :80                 │
│  │   ├── /        → React SPA   │
│  │   ├── /api/    → FastAPI     │
│  │   └── /ws      → WebSocket   │
│  └── FastAPI :8000              │
│      ├── REST CRUD API          │
│      ├── MediaMTX 폴링 (15s)    │
│      └── WebSocket 브로드캐스트  │
└─────────────────────────────────┘
```

## 빠른 시작

```bash
# 1. 저장소 클론
git clone <repo> camnet && cd camnet

# 2. 환경 변수 설정 (선택)
cp backend/.env.example backend/.env

# 3. 빌드 & 실행
docker-compose up --build -d

# 4. 브라우저 접속
open http://localhost
```

## 디렉토리 구조

```
camnet/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI 진입점
│   │   ├── core/
│   │   │   ├── config.py         # 환경 변수 설정
│   │   │   ├── database.py       # SQLAlchemy async 세션
│   │   │   └── ws_manager.py     # WebSocket 연결 관리
│   │   ├── models/
│   │   │   ├── camera.py         # Camera DB 모델
│   │   │   └── floor_map.py      # FloorMap DB 모델
│   │   ├── schemas/
│   │   │   └── camera.py         # Pydantic 스키마
│   │   ├── api/
│   │   │   ├── cameras.py        # 카메라 CRUD 라우터
│   │   │   ├── maps.py           # 도면 맵 라우터
│   │   │   └── ws.py             # WebSocket 엔드포인트
│   │   └── services/
│   │       └── polling.py        # MediaMTX 상태 폴링
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api.js                # REST + WebSocket 클라이언트
│   │   └── ...                   # React 컴포넌트 (ipcam-dashboard.jsx)
│   └── Dockerfile
├── nginx/
│   └── default.conf
└── docker-compose.yml
```

## MediaMTX 설정 요구사항

각 라즈베리파이의 `mediamtx.yml`에서 API 활성화:

```yaml
# mediamtx.yml
api: yes
apiAddress: :9997   # REST API 포트 (CamNET이 상태 체크에 사용)
```

## 환경 변수 (backend/.env)

| 변수              | 기본값                              | 설명                     |
|-----------------|-------------------------------------|--------------------------|
| DATABASE_URL    | sqlite+aiosqlite:////data/camnet.db | DB 연결 문자열            |
| POLL_INTERVAL   | 15                                  | MediaMTX 폴링 주기 (초)   |
| OFFLINE_THRESHOLD| 30                                 | 오프라인 판정 임계값 (초)   |
| DEBUG           | false                               | 디버그 로그 출력            |

## API 문서

서버 실행 후 http://localhost/api/docs 접속 (Swagger UI)

## PostgreSQL 전환 (프로덕션)

`docker-compose.yml`의 PostgreSQL 주석을 해제하고 DATABASE_URL을 변경:

```
DATABASE_URL=postgresql+asyncpg://camnet:changeme@db:5432/camnet
```
