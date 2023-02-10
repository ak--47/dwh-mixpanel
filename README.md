# 🏭 dwh-mixpanel

Stream queries from your data warehouse to events, profiles, groups, or lookup tables in Mixpanel...  rETL style 💫. 

No intermediate staging/storage required.

Supported Data Warehouses:
- [Google BigQuery](#bq)
- [AWS Athena](#athena)
- [Snowflake](#snowflake)

<div id="tldr"></div>

## 👔 tldr; 
run the module, and provide a [configuration file](#config) as the first argument:
```bash
npx dwh-mixpanel ./myConfig.json
```

for help building a [configuration file](#config), run the module with no arguments:
```bash
npx dwh-mixpanel ./myConfig.json
```

if you will use this module frequently, consider a global install:

```
npm install --global dwh-mixpanel 
```

and then you don't need the `npx`:
```
dwh-mixpanel ./myConfig.json
```

**what next?**
- check out the [demo](#demo) 
- learn about using the [cli](#cli)
- create an automated pipeline with a [module](#module)

<div id="demo"></div>

## 🍿 demo

todo

<div id="cli"></div>

### 👨‍💻️ cli

as stated in the [tldr](#tldr), if you run `dwh-mixpanel` with **no arguments** you get a CLI which helps you build a [configuration file](#config):
```bash
npx dwh-mixpanel
```
it looks like this: 

<img src="https://aktunes.neocities.org/dwh-mixpanel/cliWalk-sm.gif" alt="cli walkthrough"/>

at the end of this walkthrough, a JSON file will be saved to your current working directory; it will contain the details of what you typed into the CLI. the CLI will then ask you if you'd like to trigger a run.

once you have a configuration file, you can run (and _re-run_) that job by passing the configuration file as the first argument to the script:

```bash
npx dwh-mixpanel snowflake-mixpanel.json
```
as it runs, you'll get some console output as to the status of your job:

<img src="https://aktunes.neocities.org/dwh-mixpanel/demo.gif" alt="demo" />

once it's complete, it will stash logs in the current working directory.

<div id="module"></div>

### 🔄 module <div id="module"></div>

`dwh-mixpanel` can also be used as a ESM module inside any node.js environment.

install it from `npm`:
```bash
npm install dwh-mixpanel
```

and then you use it as any other dependency:
```javascript
import dwhMp from 'dwh-mixpanel'
```

`dwh-mixpanel` exports a single function, which takes in a single parameter - a [configuration object](#config). 

this is the entry-point for the whole module:

```javascript
const myConfig = {
	dwh: "athena",
	sql: "SELECT * FROM EVENTS",
	//etc...
}

const athenaToMp = await dwhMp(myConfig)
```

the module returns a `summary` of the unload/load job, with statistics and logs about how many records were processed, throughput, and metadata from the warehouse.

<div id="config"></div>

### configuration
your configuration is an object (or JSON) with the following structure:
```javascript
{
	dwh: "", 		// warehouse name
	auth: {},		// warehouse auth details
	sql: "",		// a SQL query
	mappings: {},	// col headers → mixpanel fields
	mixpanel: {},	// mixpanel auth
	options: {},	// job options
	tags: {}		// arbitrary tags
}
```

you can find [examples](https://github.com/ak--47/dwh-mixpanel) in the repo for different warehouses. additionally, the module is typed using jsdoc, so you should have a good experience using it in code:

<img src="https://aktunes.neocities.org/dwh-mixpanel/devxp.gif" alt="developer experience" />

here's a description of each of those keys (and values) mean

##### dwh 
a string representing the data warehouse you're connecting too. 

`bigquery`, `athena`, `snowflake`

##### auth 
an object `{}` containing the service account/credentials to use when authenticating with the data warehouse.

each cloud warehouse has it's own methods of authenticating API calls, which usually consist of a username or public key and a password, secret, or private key.

to read more about the ways you can authenticate with a supported data warehouse, see [warehouse details](#warehouse)

##### sql

a valid SQL Query to run (as a job) in your data warehouse; this query will usually be in the form of a `SELECT {fields}` or `SELECT *` statement:

```SQL
SELECT 
  eventName,
  user_id,
  time,
  prop_a,
  prop_b, 
  prop_c,
  rowIdentifier as insert_id
FROM 
  "myProject.myDB.myTable"
WHERE 
  env is "prod"
```
your SQL query should produce a **flat, non-nested table that has the fields and records you wish to stream to mixpanel**. your column headers can have any title; you will provide a mappings dictionary (detailed below) to describe how mixpanel should receive the fields. 

**note:** property field labels can be retitled post-ingestion using [lexicon](https://help.mixpanel.com/hc/en-us/articles/360001307806-Lexicon-Overview#adding-or-changing-descriptions), mixpanel's data governance suite.

##### mappings
an object `{}` containing a map of columns headers to mixpanel property keys.

providing mappings is not a tedious task; mixpanel is a schemaless tool for semi-structured data, so any column not explicitly mapped which is present in the table will become an event/user property key and value.

the fields you will provide mappings for depend on the type of data you're importing:

**events** mappings

```javascript
{
	// REQUIRED
  'event_name_col': '' 		// column for event name
  'distinct_id_col': '' 	// column for uniquer user id
  'time_col': '' 			// column for event time
	// OPTIONAL
  'insert_id_col': '' 		// column for row id (deduplication)
}
```

**user or group profiles** mappings

```javascript
{
	// REQUIRED
 'distinct_id_col': '' // column for uniquer user id
 	// OPTIONAL
 'profileOperation': '' // the $set style operation to use
 'name_col': '' // column $name to use for the user/group profile
 'email_col': '' // column $email to use for the user/group profile
 'avatar_col': '' // column $email to use for the user/group profile
 'created_col': '' // column $created (timestamp) to use 
 'phone_col': '' // column $phone to use for the user/group profile
 'latitude_col': '' // column $latitude to use for the user/group profile
 'longitude_col': '' // column $longitude to use for the user/group profile
 'ip_co': '' // column $ip to use for the user/group profile
}
```

**lookup tables** mappings

```javascript
{
	// REQUIRED
	'lookup_col' : '' //the "join" column for the lookup table
	//hint: ^ this is usually the first column in the table
}
```

the key to remember about `mappings` is that you a giving the module a guide to understand how to map fields from your warehouse to required fields for the different mixpanel data types.

##### mixpanel
an object `{}` containing authentication details used to connect to your mixpanel project.

```javascript
{
	project_id: '',  			//your mixpanel project id
	type: 'event',				//type of record to import
	region: 'US',				//or EU

	//one of service details OR api secret is required
	service_account: '',  		//service account user name
	service_secret: '', 		//service account secret
 	
	api_secret: '',				//project api secret [deprecated]


	//required for profiles
 	token: '', 					//mixpanel project token

	//required for groups
	groupKey: '',				//the group key for this group

	//required for lookup tables
	lookupTableId: ''			//the lookup table to replace	
}
```

##### options
an object `{}` containing various options for the job. the `workers` option is important because it governs concurrency, which can greatly affect throughput.

```javascript
{
	logFile: 'myLog.txt', // local path to write log files to
 	verbose: true,  // display verbose console output
 	strict: false, // use strict mode when sending data to mixpanel
 	compress: false,  // gzip data before egress
 	workers: 20 // number of concurrent workers to make requests to mixpanel
}
```

##### tags (optional)
an object `{}` containing arbitrary key:value string pairs that will be used to tag the data. this is particularly useful if this module is being used as part of an automated pipeline, and you wish to tag the data with `runIds`.

```javascript
{
	mixpanel: {
		type: "event"
	}
	tags: {
		"foo": "bar" 
		// every event in mixpanel will have a {foo: 'bar'} prop
	}
}
```

<div id="warehouse"></div>

### warehouse details

the data warehouse connectors used by this module are implemented as "middleware", and therefore they have different authentication strategies an dependencies.

below, i detail the most commonly used authentication methods for each supported warehouse, but there are probably cases which are not covered. if you find an auth method that you need is not supported for a particular warehouse, [please file an issue](https://github.com/ak--47/dwh-mixpanel/issues)

<div id="bq"></div>

##### BigQuery 
todo
<div id="snowflake"></div>

##### Snowflake 
todo
<div id="athena"></div>

##### Athena 
todo

<div id="env"></div>

### environment variables

todo

