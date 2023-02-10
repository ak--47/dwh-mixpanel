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

once it's complete, it will stash logs in the current working directory, and you can see your data in mixpanel!

**note:** if you will use this module frequently, consider a global install:

```
npm install --global dwh-mixpanel 
```

and then you don't need the `npx`:
```
dwh-mixpanel ./myConfig.json
```

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

```javascript
{
  mixpanel: {
    success: 100000,
    failed: 0,
    total: 100000,
    requests: 50,
    recordType: "event",
    duration: 15314,
    human: "15.314 seconds",
    retries: 0,
    version: "2.2.287",
    workers: 10,
    eps: 6529,
    rps: 3.265,
    responses: [],
    errors: [],
  },
  bigquery: {
    job: {
      //job infos
    },
    metadata: {
      //query metadata
    },
    schema: {
      //schema
    }    
  }
}
```

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

you can find [examples](https://github.com/ak--47/dwh-mixpanel) in the repo for different warehouses. additionally, the module is typed using jsdoc, so you should have a good experience using it in your IDE:

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

providing mappings is not a tedious task; mixpanel is a schemaless tool designed for semi-structured data, so **any column not explicitly mapped which is present in the table will become an event/user property key and value**.

the fields you must provide mappings for depend on the type of data you're importing:

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
note: `insert_id_col` is **required** when using `strict` mode

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
note: you can find most of these values in the **[your mixpanel project's settings](https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings)**

##### options
an object `{}` containing various options for the job. 

```javascript
{
	logFile: 'myLog.txt', // local path to write log files to
 	verbose: true,  // display verbose console output
 	strict: false, // use strict mode when sending data to mixpanel
 	compress: false,  // gzip data before egress
 	workers: 20 // number of concurrent workers to make requests to mixpanel
}
```
the `workers` option is important because it governs concurrency, which can greatly affect throughput.

##### tags (optional)
an object `{}` containing arbitrary `key:value` string pairs that will be used to tag the data. this is particularly useful if this module is being used as part of an automated pipeline, and you wish to tag the data with `runIds` or some other reference value.

```javascript
{
	mixpanel: {
		type: "event"
	},	
	tags: {
		"foo": "bar" 
		// every event in mixpanel will have a {foo: 'bar'} prop
	}
}
```

this works on all record types:

```javascript
{
	mixpanel: {
		type: "user"
	},	
	tags: {
		"baz": "qux" 
		// every user profile updated will have a {baz: 'qux'} prop
	}
}
```

<div id="warehouse"></div>

### warehouse details

the data warehouse connectors used by this module are implemented as "middleware", and therefore they have different authentication strategies and dependencies.

in most cases, `dwh-mixpanel` wraps the vendor SDKs in it's own API, so when passing `auth` params in your configuration, you can use anything values that are supported by your warehouse, provided those credentials have the appropriate permissions.

below, i detail the most commonly used authentication methods for each supported warehouse, along with the permission required to run a successful job. if you find an auth method or strategy that you need and is not supported for your warehouse, [please file an issue](https://github.com/ak--47/dwh-mixpanel/issues)

<div id="bq"></div>

##### BigQuery 
most bigquery jobs will be authenticated with GCP [service accounts](https://cloud.google.com/iam/docs/service-accounts)

the service account will need the following permissions in bigquery AND on the specific dataset being queried:
- [`bigquery.jobs.create`](https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=Run%20jobs%20(including%20queries)%20within%20the%20project.)
- [`bigquery.jobs.get`](https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=Get%20data%20and%20metadata%20on%20any%20job.1)
- [`bigquery.datasets.get`](https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=Get%20metadata%20about%20a%20dataset.)
- [`bigquery.tables.get	`](https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=out%20of%20BigQuery.-,bigquery.tables.get,-Get%20table%20metadata)
- [`bigquery.tables.getData`](https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=Get%20table%20data.%20This%20permission%20is%20required%20for%20querying%20table%20data.%0ATo%20get%20table%20metadata%2C%20you%20need%20bigquery.tables.get.)

in my experience, the `data editor` role set satisfies these cases; if a required permission is missing, the output will tell you what it is.

these typical fields used for auth are `project_id`, `private_key`, and `client_email`; `location` will need to be added manually based on the [region of your bigquery instance](https://cloud.google.com/bigquery/docs/locations):
```javascript
dwh: "bigquery",
auth : {
		"project_id": "my-gcp-project", //GCP project
		"client_email": "serviceAccount@email.com", //service acct email
		"private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",	// service account private key
		"location": "US" //bigquery location.. this is required!
	}
```

in most cases, you can [drop your exported JSON keys](https://cloud.google.com/iam/docs/creating-managing-service-accounts) into the `auth` param, and it will work.

<div id="snowflake"></div>

##### Snowflake 
most snowflake jobs with authenticate with a user name + password. note that 2FA is not currently supported in this module.

these fields used for auth are `project_id`, `private_key`, and `client_email`; `location` will need to be added manually based on the [region of your bigquery instance](https://cloud.google.com/bigquery/docs/locations):
```javascript
dwh: "snowflake",
auth : {
        "account": "foobar.us-central1.gcp", // your snowflake identifier
        "username": "",
        "password": "",
        "database": "PROD1", // database to use
        "schema": "PUBLIC", // schema to use
        "warehouse": "COMPUTE_WH" //warehouse to use
    }
```

no special permissions are required for snowflake - only that the user/pass you entered can view and query the datatset.

<div id="athena"></div>

##### Athena 



```javascript
dwh: "athena",
auth : {
		"accessKeyId": "",
		"secretAccessKey": "",
		"region": "us-east-2" //note this is important!
	}
```

<div id="env"></div>

### environment variables

todo

