import json
from datetime import datetime
from typing import Dict, List

from data_source.api.base_data_source import BaseDataSource
from data_source.api.dynamic_loader import DynamicLoader, ClassInfo
from data_source.api.exception import KnownException
from db_engine import Session
from schemas import DataSourceType, DataSource


class DataSourceContext:
    """
    This class is responsible for loading data sources and caching them.
    It dynamically loads data source types from the data_source/sources directory.
    It loads data sources from the database and caches them.
    """
    _initialized = False
    _data_sources: Dict[int, BaseDataSource] = {}

    @classmethod
    def get_data_source(cls, data_source_id: int) -> BaseDataSource:
        if not cls._initialized:
            cls.init()
            cls._initialized = True

        return cls._data_sources[data_source_id]

    @classmethod
    def create_data_source(cls, name: str, config: dict) -> BaseDataSource:
        with Session() as session:
            data_source_type = session.query(DataSourceType).filter_by(name=name).first()
            if data_source_type is None:
                raise KnownException(message=f"Data source type {name} does not exist")

            data_source_class = DynamicLoader.get_data_source_class(name)
            data_source_class.validate_config(config)
            config_str = json.dumps(config)

            data_source_row = DataSource(type_id=data_source_type.id, config=config_str, created_at=datetime.now())
            session.add(data_source_row)
            session.commit()

            data_source = data_source_class(config=config, data_source_id=data_source_row.id)
            cls._data_sources[data_source_row.id] = data_source

            return data_source

    @classmethod
    def delete_data_source(cls, data_source_id: int):
        with Session() as session:
            data_source = session.query(DataSource).filter_by(id=data_source_id).first()
            if data_source is None:
                raise KnownException(message=f"Data source {data_source_id} does not exist")

            session.delete(data_source)
            session.commit()

            del cls._data_sources[data_source_id]

    @classmethod
    def init(cls):
        cls._add_data_sources_to_db()
        cls._load_context_from_db()

    @classmethod
    def _load_context_from_db(cls):
        with Session() as session:
            data_sources: List[DataSource] = session.query(DataSource).all()
            for data_source in data_sources:
                data_source_cls = DynamicLoader.get_data_source_class(data_source.type.name)
                config = json.loads(data_source.config)
                data_source_instance = data_source_cls(config=config, data_source_id=data_source.id,
                                                       last_index_time=data_source.last_indexed_at)
                cls._data_sources[data_source.id] = data_source_instance

        cls._initialized = True

    @classmethod
    def _add_data_sources_to_db(cls):
        data_sources: Dict[str, ClassInfo] = DynamicLoader.find_data_sources()

        with Session() as session:
            for source_name in data_sources.keys():
                if session.query(DataSourceType).filter_by(name=source_name).first():
                    continue

                class_info = data_sources[source_name]
                data_source_class = DynamicLoader.get_class(file_path=class_info.file_path,
                                                            class_name=class_info.name)

                config_fields = data_source_class.get_config_fields()
                config_fields_str = json.dumps([config_field.dict() for config_field in config_fields])
                new_data_source = DataSourceType(name=source_name,
                                                 display_name=data_source_class.get_display_name(),
                                                 config_fields=config_fields_str)
                session.add(new_data_source)
                session.commit()
