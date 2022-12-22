delete
from T_APP_PROPERTIES
where NAME = 'sys.dbType'
;
insert into T_APP_PROPERTIES (NAME, VALUE)
values ('sys.dbType', 'mysql')
;

delete
from T_SERVICES
where SERVICE_ID != ''
;

insert into T_SERVICES (SERVICE_ID, STATEMENTS, TAGS, ROLES, SOURCE)
values ('saveService',
        'delete from T_SERVICES
        where SERVICE_ID = :SERVICE_ID;insert into T_SERVICES
        (SERVICE_ID, STATEMENTS, TAGS, ROLES, SOURCE)
        values
        (:SERVICE_ID, :statements, :TAGS, :ROLES, :source)
        ', '', 'SYSTEM,APP_ADMIN', 'init1-bootstrap.sql')
;

