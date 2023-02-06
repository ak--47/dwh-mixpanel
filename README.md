# dwh-mixpanel

Stream queries from your data warehouse to events/profiles/groups/lookup tables in Mixpanel. No intermediate staging or storage required.

docs todo... 

but essentially build a config like this:

```javascript
{
	"dwh": "snowflake", // or bigquery, athena
	"auth": {
        //auth params for dwh
    },
	"sql": "select * from big_events", // runs on DWH; models data
	"mappings": {
		"event_name_col": "action",
		"distinct_id_col": "uuid",
		"time_col": "time",
		"insert_id_col": "primary_key"
	},
	"mixpanel": {
		"project_id": "",
		"service_acct": "",
		"service_secret": "",
		"type": "event" // user, group, table
	},
	"options": {
		"test": false,
		"logFile": "./tmp/log.txt",
		"strict": true,
		"compress": true,
		"verbose": true
	},
	"tags": {
		"foo": "bar" //get appended to each record
	}
}
```

and plug it into `main()`
