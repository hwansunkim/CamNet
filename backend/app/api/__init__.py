from app.api.cameras import router as cameras_router
from app.api.maps import router as maps_router
from app.api.ws import router as ws_router

__all__ = ["cameras_router", "maps_router", "ws_router"]
