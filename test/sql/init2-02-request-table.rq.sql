--
-- SERVICE_ID = newTid
-- ROLES      = SYSTEM
--

select NEXTVAL()
from T_DUAL
;



--
-- SERVICE_ID = appProperties.select
-- ROLES      = ADMIN
-- insert into T_REQUEST_PARAMETERS (RID, OP, NAME, VALUE)
-- values (:RID, 'set-if-empty', 'name', '%');
-- ;
select *
from T_APP_PROPERTIES
order by NAME
;


--
-- SERVICE_ID = appProperties.get
-- ROLES      = ADMIN,SYSTEM

select VALUE
from T_APP_PROPERTIES
where NAME = :name
;


--
-- SERVICE_ID = appProperties.insert
-- ROLES      = SYSTEM,ADMIN

insert into T_APP_PROPERTIES (NAME, VALUE)
values (:name, :value)
;


--
-- SERVICE_ID = appProperties.update
-- ROLES      = SYSTEM,ADMIN
--

update T_APP_PROPERTIES
set VALUE = :value
where NAME = :name
;
insert into T_REQUEST_PARAMETERS (RID, SERVICE_ID)
values (:RID, 'appProperties.select');
;


--
-- SERVICE_ID = appProperties.delete
-- ROLES      = SYSTEM,ADMIN
--

delete
from T_APP_PROPERTIES
where NAME = :name
;
