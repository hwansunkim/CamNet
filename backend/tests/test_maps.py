"""
FloorMap API 테스트 (synchronous TestClient)
"""


class TestMapAPI:

    def test_list_maps_empty(self, client):
        """맵이 없을 때 빈 리스트 반환."""
        resp = client.get("/api/maps/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_map(self, client, sample_map_data):
        """도면 생성 성공."""
        resp = client.post("/api/maps/", json=sample_map_data)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "1층 도면"
        assert data["description"] == "테스트용 도면"
        assert len(data["rooms"]) == 1
        assert data["rooms"][0]["label"] == "거실"

    def test_create_map_without_rooms(self, client):
        """방 없이 빈 도면 생성."""
        resp = client.post("/api/maps/", json={"name": "빈 도면"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["rooms"] == []

    def test_list_maps_after_create(self, client, sample_map_data):
        """도면 생성 후 리스트에 표시."""
        client.post("/api/maps/", json=sample_map_data)
        resp = client.get("/api/maps/")
        assert resp.status_code == 200
        maps = resp.json()
        assert len(maps) == 1

    def test_update_rooms(self, client, sample_map_data):
        """방 목록 업데이트."""
        create_resp = client.post("/api/maps/", json=sample_map_data)
        map_id = create_resp.json()["id"]

        new_rooms = [
            {"id": "room1", "label": "거실", "x": 10, "y": 10, "w": 40, "h": 30, "color": "#141c28"},
            {"id": "room2", "label": "주방", "x": 60, "y": 10, "w": 30, "h": 30, "color": "#1a2030"},
        ]
        resp = client.put(f"/api/maps/{map_id}/rooms", json=new_rooms)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["rooms"]) == 2
        assert data["rooms"][1]["label"] == "주방"

    def test_update_rooms_not_found(self, client):
        """존재하지 않는 맵의 방 업데이트 시 404."""
        rooms = [{"id": "r1", "label": "test", "x": 0, "y": 0, "w": 10, "h": 10}]
        resp = client.put("/api/maps/nonexistent-id/rooms", json=rooms)
        assert resp.status_code == 404
