import logging


def configure_logging(level: str = "INFO") -> None:
    resolved = getattr(logging, str(level).upper(), logging.INFO)
    logging.basicConfig(level=resolved, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


__all__ = ["configure_logging", "get_logger"]
