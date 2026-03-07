import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture()
def mock_redis():
    """Redis mock que simula un store en memoria."""
    store = {}
    ttls = {}
    sets = {}

    mock = MagicMock()
    mock.ping.return_value = True

    def setex(key, ttl, value):
        store[key] = value
        ttls[key] = ttl

    def get(key):
        return store.get(key)

    def delete(key):
        removed = key in store
        store.pop(key, None)
        return 1 if removed else 0

    def ttl(key):
        return ttls.get(key, -2)

    def exists(key):
        return 1 if key in store else 0

    def set_(key, value):
        store[key] = value

    def sadd(key, *values):
        if key not in sets:
            sets[key] = set()
        sets[key].update(values)

    def smembers(key):
        return sets.get(key, set())

    def srem(key, *values):
        if key in sets:
            sets[key] -= set(values)

    def expire(key, ttl):
        ttls[key] = ttl

    def incr(key):
        store[key] = int(store.get(key, 0)) + 1
        return store[key]

    def scan_iter(pattern):
        import fnmatch
        return [k for k in store if fnmatch.fnmatch(k, pattern)]

    mock.setex = setex
    mock.get = get
    mock.delete = delete
    mock.ttl = ttl
    mock.exists = exists
    mock.set = set_
    mock.sadd = sadd
    mock.smembers = smembers
    mock.srem = srem
    mock.expire = expire
    mock.incr = incr
    mock.scan_iter = scan_iter

    return mock


@pytest.fixture()
def client(mock_redis):
    with patch("app.core.redis_store.redis.Redis", return_value=mock_redis):
        # Reimportar para que use el mock
        import importlib
        import app.core.redis_store as rs
        importlib.reload(rs)
        rs.redis_store.redis = mock_redis

        from app.main import app
        with TestClient(app) as c:
            yield c
