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


