import os
from datetime import datetime, date
from supabase import create_client, Client
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

# Initialize Supabase Client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("CRITICAL ERROR: SUPABASE_URL and/or SUPABASE_KEY are missing from your environment variables! Please add them to your Pterodactyl panel or .env file.")

supabase: Client = create_client(supabase_url, supabase_key)

# Global registry of models
models_registry = {}

class Column:
    def __init__(self, *args, **kwargs):
        self.name = None
        self.primary_key = kwargs.get('primary_key', False)

class Integer(Column): pass
class String(Column): pass
class DateTime(Column): pass
class Boolean(Column): pass
class Text(Column): pass

class ForeignKey:
    def __init__(self, target, **kwargs):
        self.target = target

class ColumnWrapper:
    def __init__(self, name):
        self.name = name
    def __eq__(self, other):
        return (self.name, "eq", other)
    def __ne__(self, other):
        return (self.name, "neq", other)
    def __gt__(self, other):
        return (self.name, "gt", other)
    def __ge__(self, other):
        return (self.name, "gte", other)
    def __lt__(self, other):
        return (self.name, "lt", other)
    def __le__(self, other):
        return (self.name, "lte", other)
    def in_(self, other):
        return (self.name, "in", other)
    def like(self, other):
        return (self.name, "like", other)
    def ilike(self, other):
        return (self.name, "ilike", other)
    def desc(self):
        return (self.name, True)
    def asc(self):
        return (self.name, False)

class QueryProperty:
    def __init__(self, cls):
        self.cls = cls
    def __get__(self, instance, owner):
        return Query(self.cls)

class Query:
    def __init__(self, cls):
        self.cls = cls
        self.filters = []
        self.order_by_clause = None
        self.limit_val = None

    def filter_by(self, **kwargs):
        for k, v in kwargs.items():
            self.filters.append((k, "eq", v))
        return self

    def filter(self, *criterion):
        for c in criterion:
            if isinstance(c, tuple) and len(c) == 3:
                self.filters.append(c)
        return self

    def order_by(self, clause):
        self.order_by_clause = clause
        return self

    def limit(self, n):
        self.limit_val = n
        return self

    def _execute(self):
        tbl_name = self.cls.__tablename__
        q = supabase.table(tbl_name).select("*")
        
        for col, op, val in self.filters:
            if op == "eq":
                if val is None:
                    q = q.is_(col, "null")
                else:
                    q = q.eq(col, val)
            elif op == "neq":
                if val is None:
                    q = q.not_.is_(col, "null")
                else:
                    q = q.neq(col, val)
            elif op == "gt":
                q = q.gt(col, val)
            elif op == "gte":
                q = q.gte(col, val)
            elif op == "lt":
                q = q.lt(col, val)
            elif op == "lte":
                q = q.lte(col, val)
            elif op == "in":
                q = q.in_(col, list(val))
            elif op == "like":
                q = q.like(col, val)
            elif op == "ilike":
                q = q.ilike(col, val)

        if self.order_by_clause:
            descending = False
            col_name = None
            if isinstance(self.order_by_clause, ColumnWrapper):
                col_name = self.order_by_clause.name
            elif isinstance(self.order_by_clause, tuple) and len(self.order_by_clause) == 2:
                col_name, descending = self.order_by_clause
            elif hasattr(self.order_by_clause, 'name'):
                col_name = self.order_by_clause.name
            else:
                s = str(self.order_by_clause).lower()
                if " desc" in s:
                    col_name = s.split(" ")[0].split(".")[-1]
                    descending = True
                else:
                    col_name = s.split(".")[-1]
            
            if col_name:
                q = q.order(col_name, desc=descending)

        if self.limit_val is not None:
            q = q.limit(self.limit_val)

        res = q.execute()
        
        # Parse datetimes for fields that should be datetime objects
        results = []
        for row in res.data:
            parsed_row = {}
            for k, v in row.items():
                col_obj = self.cls._columns.get(k)
                if isinstance(col_obj, DateTime) and v:
                    try:
                        clean_v = v.split('+')[0].split('Z')[0]
                        parsed_row[k] = datetime.fromisoformat(clean_v)
                    except Exception:
                        parsed_row[k] = v
                else:
                    parsed_row[k] = v
            results.append(self.cls(**parsed_row))
        return results

    def all(self):
        return self._execute()

    def first(self):
        self.limit_val = 1
        res = self._execute()
        return res[0] if res else None

    def count(self):
        res = self._execute()
        return len(res)

class RelationshipDescriptor:
    def __init__(self, target_model_name, backref=None):
        self.target_model_name = target_model_name
        self.backref = backref

    def __get__(self, instance, owner):
        if instance is None:
            return self
        
        target_model = models_registry.get(self.target_model_name)
        if not target_model:
            raise ValueError(f"Model {self.target_model_name} not found in registry.")

        fk_col = None
        for col_name, col in target_model._columns.items():
            if col_name == owner.__name__.lower() + "_id" or col_name == "user_id" or col_name == "owner_id" or col_name == "reporter_id":
                fk_col = col_name
                break
        
        if not fk_col:
            fk_col = owner.__name__.lower() + "_id"

        return target_model.query.filter_by(**{fk_col: instance.id}).all()

class ModelMetaclass(type):
    def __new__(mcs, name, bases, attrs):
        columns = {}
        relationships = {}
        for k, v in list(attrs.items()):
            if isinstance(v, Column):
                v.name = k
                columns[k] = v
            elif isinstance(v, RelationshipDescriptor):
                relationships[k] = v
        
        attrs['_columns'] = columns
        attrs['_relationships'] = relationships
        
        cls = super().__new__(mcs, name, bases, attrs)
        models_registry[name] = cls
        cls.query = QueryProperty(cls)
        
        for k in columns:
            setattr(cls, k, ColumnWrapper(k))
            
        return cls

class Model(metaclass=ModelMetaclass):
    def __init__(self, **kwargs):
        for col_name in self._columns:
            setattr(self, col_name, kwargs.get(col_name, None))
        for k, v in kwargs.items():
            if k not in self._columns:
                setattr(self, k, v)
        self._is_new = True

    def __getattr__(self, name):
        for model_name, cls in models_registry.items():
            for rel_name, rel in cls._relationships.items():
                if rel.backref == name:
                    parent_id = getattr(self, cls.__name__.lower() + "_id", None) or getattr(self, "user_id", None) or getattr(self, "owner_id", None) or getattr(self, "reporter_id", None)
                    if parent_id is not None:
                        return cls.query.filter_by(id=parent_id).first()
        raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{name}'")

class Session:
    def __init__(self):
        self.new_objects = set()
        self.deleted_objects = set()
        self._before_flush_listeners = []

    def get(self, model_cls, id):
        return model_cls.query.filter_by(id=id).first()

    def add(self, obj):
        self.new_objects.add(obj)

    def delete(self, obj):
        self.deleted_objects.add(obj)

    def commit(self):
        all_objects = self.new_objects | self.deleted_objects
        for listener in self._before_flush_listeners:
            listener(self, None, all_objects)

        for obj in list(self.deleted_objects):
            tbl = obj.__tablename__
            if getattr(obj, 'id', None) is not None:
                supabase.table(tbl).delete().eq("id", obj.id).execute()
        self.deleted_objects.clear()

        for obj in list(self.new_objects):
            tbl = obj.__tablename__
            data = {}
            for col in obj._columns:
                val = getattr(obj, col, None)
                if val is not None:
                    if isinstance(val, (datetime, date)):
                        data[col] = val.isoformat()
                    else:
                        data[col] = val
            
            if data.get("id") is None:
                data.pop("id", None)

            if getattr(obj, "id", None) is not None:
                supabase.table(tbl).update(data).eq("id", obj.id).execute()
            else:
                res = supabase.table(tbl).insert(data).execute()
                if res.data:
                    obj.id = res.data[0].get("id")
            
            obj._is_new = False
            
        self.new_objects.clear()

    def rollback(self):
        self.new_objects.clear()
        self.deleted_objects.clear()

    def flush(self):
        for obj in list(self.new_objects):
            if getattr(obj, "id", None) is None:
                tbl = obj.__tablename__
                data = {}
                for col in obj._columns:
                    val = getattr(obj, col, None)
                    if isinstance(val, (datetime, date)):
                        data[col] = val.isoformat()
                    else:
                        data[col] = val
                if "id" in data and data["id"] is None:
                    data.pop("id")
                res = supabase.table(tbl).insert(data).execute()
                if res.data:
                    obj.id = res.data[0].get("id")

class MockInspect:
    def __init__(self, obj):
        self.obj = obj
        self.transient = False
        self.pending = False
        self.attrs = [self.MockAttr(k) for k in obj._columns]
    
    class MockAttr:
        def __init__(self, key):
            self.key = key
            class MockHistory:
                def has_changes(self):
                    return False
            self.history = MockHistory()

    def get_history(self, attr_name, passive=True):
        class MockHistory:
            def __init__(self, val):
                self.unchanged = [val]
                self.deleted = []
            def has_changes(self):
                return False
        return MockHistory(getattr(self.obj, attr_name, False))

class Func:
    def current_timestamp(self):
        return datetime.utcnow()

class SupabaseSQLAlchemy:
    def __init__(self):
        self.Model = Model
        self.Column = Column
        self.Integer = Integer
        self.String = String
        self.DateTime = DateTime
        self.Boolean = Boolean
        self.Text = Text
        self.ForeignKey = ForeignKey
        self.relationship = RelationshipDescriptor
        self.session = Session()
        self.func = Func()
        self.metadata = self

    def init_app(self, app):
        pass

    def inspect(self, obj):
        return MockInspect(obj)

db = SupabaseSQLAlchemy()
migrate = type('Migrate', (object,), {'init_app': lambda self, *args, **kwargs: None})()

class Event:
    def listens_for(self, target, event_name):
        def decorator(f):
            if target == db.session and event_name == 'before_flush':
                db.session._before_flush_listeners.append(f)
            return f
        return decorator

event = Event()
relationship = RelationshipDescriptor

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize Limiter without an app instance to allow imports in blueprint files
limiter = Limiter(key_func=get_remote_address, default_limits=["50 per minute"], storage_uri="memory://")