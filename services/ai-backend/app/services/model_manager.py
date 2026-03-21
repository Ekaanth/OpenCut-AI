"""GPU and memory management for ML models.

Coordinates loading/unloading of heavy models so that only one major model
occupies GPU memory at a time. This is important on consumer hardware where
VRAM is limited.
"""

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class ModelManager:
    """Manages active ML models and GPU memory."""

    _instance: "ModelManager | None" = None

    # Known model services and their unload callables
    _services: dict[str, Any] = {}
    _active_model: str | None = None

    def __new__(cls) -> "ModelManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._services = {}
            cls._instance._active_model = None
        return cls._instance

    def register(self, name: str, service: Any) -> None:
        """Register a model service.

        The service must have an `unload` or `unload_model` method and an
        `is_loaded` property.
        """
        self._services[name] = service
        logger.debug("Registered model service: %s", name)

    def activate(self, model_name: str) -> None:
        """Activate a model, unloading the previous one if different.

        Args:
            model_name: The name of the model service to activate.
        """
        if model_name == self._active_model:
            return

        # Unload the currently active model
        if self._active_model and self._active_model in self._services:
            prev = self._services[self._active_model]
            if getattr(prev, "is_loaded", False):
                unload = getattr(prev, "unload_model", None) or getattr(
                    prev, "unload", None
                )
                if unload:
                    logger.info(
                        "Unloading '%s' to make room for '%s'",
                        self._active_model,
                        model_name,
                    )
                    unload()

        self._active_model = model_name
        logger.info("Active model set to '%s'", model_name)

    def get_active(self) -> str | None:
        """Return the name of the currently active model."""
        return self._active_model

    def get_memory_status(self) -> dict[str, Any]:
        """Return current memory usage information."""
        import psutil

        process = psutil.Process(os.getpid())
        mem = process.memory_info()

        status: dict[str, Any] = {
            "active_model": self._active_model,
            "process_rss_mb": round(mem.rss / 1024 / 1024, 1),
            "system_available_mb": round(
                psutil.virtual_memory().available / 1024 / 1024, 1
            ),
            "loaded_services": {
                name: getattr(svc, "is_loaded", False)
                for name, svc in self._services.items()
            },
        }

        # Try to get GPU memory info if torch is available
        try:
            import torch

            if torch.cuda.is_available():
                for i in range(torch.cuda.device_count()):
                    allocated = torch.cuda.memory_allocated(i) / 1024 / 1024
                    reserved = torch.cuda.memory_reserved(i) / 1024 / 1024
                    total = torch.cuda.get_device_properties(i).total_mem / 1024 / 1024
                    status[f"gpu_{i}"] = {
                        "name": torch.cuda.get_device_properties(i).name,
                        "allocated_mb": round(allocated, 1),
                        "reserved_mb": round(reserved, 1),
                        "total_mb": round(total, 1),
                    }
        except ImportError:
            pass

        return status


# Module-level singleton
model_manager = ModelManager()
