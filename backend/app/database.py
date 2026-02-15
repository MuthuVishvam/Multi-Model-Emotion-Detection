from db.mongo import collections


class DatabaseProxy:
    def __getattr__(self, item: str):
        return getattr(collections, item)


db = DatabaseProxy()
