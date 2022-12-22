-- for running test: set this up in mysql db 'testdb'

create table T_SEQUENCE
(
    COUNTER bigint,
    primary key (COUNTER)
)
;

insert into T_SEQUENCE (COUNTER)
values (1000)
;

--
-- T_APP_PROPERTIES
--

create table T_APP_PROPERTIES
(
    NAME  varchar(256),
    VALUE TEXT,
    primary key (NAME)
)
;

--
-- T_SERVICES
--

create table T_SERVICES
(
    SERVICE_ID varchar(256) primary key,
    STATEMENTS TEXT,
    TAGS       TEXT,
    ROLES      TEXT,
    DATASOURCE varchar(128),
    SOURCE     TEXT
)
;
create TABLE T_USER
(
    USER_TID   bigint,
    FIRST_NAME varchar(64),
    LAST_NAME  varchar(64),
    CREATOR    bigint,
    CREATED    bigint,
    UPDATER    bigint,
    UPDATED    bigint,
    STATUS     varchar(12),
    primary key (USER_TID)
)
;


create TABLE T_ROLE
(
    USER_TID bigint,
    ROLE     varchar(64),
    primary key (USER_TID, ROLE)
)
;


create TABLE T_DUAL
(
    TID bigint
)
;
delete
from T_DUAL
where TID < -1
;
insert into T_DUAL (TID)
values (0)
;
