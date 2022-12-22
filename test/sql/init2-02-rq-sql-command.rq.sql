--
-- SERVICE_ID = rqSqlCommand.test1
--

select 'set' as cmd, 'hello' as name, 'world' as value
;
select 'sql' as cmd, 'insert into T_APP_PROPERTIES (NAME, VALUE) values (''hello-command-test'', :hello)' as query;
;
select *
from T_APP_PROPERTIES
where name = 'hello-command-test'
;



--
-- SERVICE_ID = rqSqlCommand.test2
--

insert into T_APP_PROPERTIES (name, value)
values ('hans', 'müller')
;
select 'set-if-empty' as cmd, name, value
from T_APP_PROPERTIES
where NAME = 'hans'
;
delete
from T_APP_PROPERTIES
where NAME = 'hans'
;
select :hans as value
;




--
-- SERVICE_ID = rqSqlCommand.test3
--

select 'set' as cmd, 'name' as name, 'müller' as value
;
select 'set-if-empty' as cmd, 'name' as name, 'huber' as value
;
select :name as value
;

