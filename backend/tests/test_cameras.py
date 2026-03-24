"""
Camera CRUD API 테스트 (synchronous TestClient)
"""


class TestCameraAPI:

    def test_list_cameras_empty(self, client):
        """카메라가 없을 때 빈 리스트 반환."""
        resp = client.get("/api/cameras/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_camera(self, client, sample_camera_data):
        """카메라 생성 성공."""
        resp = client.post("/api/cameras/", json=sample_camera_data)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "테스트 카메라"
        assert data["ip"] == "192.168.0.100"
        assert data["status"] == "unknown"
        assert "id" in data

    def test_create_camera_password_excluded(self, client, sample_camera_data):
        """B-1: 응답에 api_password가 포함되지 않아야 함."""
        resp = client.post("/api/cameras/", json=sample_camera_data)
        assert resp.status_code == 201
        data = resp.json()
        assert "api_password" not in data

    def test_get_camera(self, client, sample_camera_data):
        """단건 카메라 조회."""
        create_resp = client.post("/api/cameras/", json=sample_camera_data)
        camera_id = create_resp.json()["id"]

        resp = client.get(f"/api/cameras/{camera_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == camera_id

    def test_get_camera_not_found(self, client):
        """존재하지 않는 카메라 조회 시 404."""
        resp = client.get("/api/cameras/nonexistent-id")
        assert resp.status_code == 404

    def test_update_camera(self, client, sample_camera_data):
        """카메라 정보 부분 업데이트."""
        create_resp = client.post("/api/cameras/", json=sample_camera_data)
        camera_id = create_resp.json()["id"]

        resp = client.patch(f"/api/cameras/{camera_id}", json={"name": "수정된 카메라"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "수정된 카메라"

    def test_update_camera_not_found(self, client):
        """존재하지 않는 카메라 수정 시 404."""
        resp = client.patch("/api/cameras/nonexistent-id", json={"name": "test"})
        assert resp.status_code == 404

    def test_delete_camera(self, client, sample_camera_data):
        """카메라 삭제."""
        create_resp = client.post("/api/cameras/", json=sample_camera_data)
        camera_id = create_resp.json()["id"]

        resp = client.delete(f"/api/cameras/{camera_id}")
        assert resp.status_code == 204

        # 삭제 후 조회 시 404
        resp = client.get(f"/api/cameras/{camera_id}")
        assert resp.status_code == 404

    def test_delete_camera_not_found(self, client):
        """존재하지 않는 카메라 삭제 시 404."""
        resp = client.delete("/api/cameras/nonexistent-id")
        assert resp.status_code == 404

    def test_list_cameras_after_create(self, client, sample_camera_data):
        """카메라 생성 후 리스트에 표시."""
        client.post("/api/cameras/", json=sample_camera_data)
        resp = client.get("/api/cameras/")
        assert resp.status_code == 200
        cameras = resp.json()
        assert len(cameras) == 1
        assert cameras[0]["name"] == "테스트 카메라"

    def test_update_position(self, client, sample_camera_data):
        """B-2: JSON body로 카메라 위치 업데이트."""
        create_resp = client.post("/api/cameras/", json=sample_camera_data)
        camera_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/cameras/{camera_id}/position",
            json={"map_x": 25.5, "map_y": 75.0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["map_x"] == 25.5
        assert data["map_y"] == 75.0

    def test_update_position_validation(self, client, sample_camera_data):
        """B-2: 범위를 벗어나는 좌표는 거부."""
        create_resp = client.post("/api/cameras/", json=sample_camera_data)
        camera_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/cameras/{camera_id}/position",
            json={"map_x": 150.0, "map_y": -10.0},
        )
        assert resp.status_code == 422  # Validation error

    def test_camera_response_has_computed_urls(self, client, sample_camera_data):
        """CameraResponse에 computed webrtc_url, rtsp_url 포함."""
        resp = client.post("/api/cameras/", json=sample_camera_data)
        assert resp.status_code == 201
        data = resp.json()
        assert "webrtc_url" in data
        assert "rtsp_url" in data
        assert data["webrtc_url"] == "http://192.168.0.100:8889/cam/"
        assert data["rtsp_url"] == "rtsp://192.168.0.100:8554/cam"
