# 🏭 dwh-mixpanel

Stream queries from your data warehouse to events, profiles, groups, or lookup tables in Mixpanel... rETL style 💫.

No intermediate staging/storage required.

Supported Data Warehouses:

- [Google BigQuery](#bq)
- [AWS Athena](#athena)
- [Snowflake](#snowflake)
- [Microsoft Azure SQL](#azure)
- [Salesforce](#salesforce)

<div id="tldr"></div>

## 👔 tldr;

run the module, and provide a [configuration file](#config) as the first argument:

```bash
npx dwh-mixpanel ./myConfig.json
```

for help building a [configuration file](#config), run the module **with no arguments**:

```bash
npx dwh-mixpanel
```

**what next?**

- check out the [demo](#demo)
- learn about using the [cli](#cli)
- create an automated pipeline using `dwh-mixpanel` as a [module](#module)

<div id="demo"></div>

## 🍿 demo

<a href="https://youtu.be/E6FeqVRVZjM"><img src="https://aktunes.neocities.org/dwh-mixpanel/frame.png" alt="bigquery to mixpanel demo" width=600/></a>

<div id="cli"></div>

### 👨‍💻️ cli

as stated in the [tldr](#tldr), if you run `dwh-mixpanel` with **no arguments** you get a CLI which helps you build a [configuration file](#config):

```bash
npx dwh-mixpanel
```

it looks like this:

<img src="https://aktunes.neocities.org/dwh-mixpanel/cliWalk-sm.gif" alt="cli walkthrough" width=400/>

at the end of this walkthrough, a JSON file will be saved to your current working directory; this JSON will contain the configuration of what you typed into the CLI. the CLI will then ask you if you'd like to trigger a run:

<img src="https://aktunes.neocities.org/dwh-mixpanel/confirm.png" alt="confirmation screen" width=500 />

once you have a configuration file, you can run (and _re-run_) that job by passing the configuration file as the first argument to this module:

```bash
npx dwh-mixpanel snowflake-mixpanel.json
```

as it runs, you'll get some console output as to the status of your job:

<img src="https://aktunes.neocities.org/dwh-mixpanel/go.gif" alt="demo" width=500/>

once the pipeline is complete, it will stash logs in the current working directory, and you can see your data in mixpanel!

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

`dwh-mixpanel` can also be used as a ESM module inside any node.js environment. this is useful for automated cloud ingestion pipelines and scheduled syncs with your warehouse.

install it from `npm`:

```bash
npm install dwh-mixpanel
```

and then you use it as you would any other dependency:

```javascript
import dwhMp from "dwh-mixpanel";
```

`dwh-mixpanel` exports a single function, which takes in a single parameter - a [configuration object](#config).

this is the entry-point for the whole module:

```javascript
const myConfig = {
  dwh: "bigquery",
  sql: "SELECT * FROM EVENTS",
  //etc...
};

const bqToMpSummary = await dwhMp(myConfig);
```

the module returns a `summary` of the entire pipeline, with statistics and logs about how many records were processed, throughput, and metadata from the warehouse.

```javascript
{
  mixpanel: {
    success: 100000,
    failed: 0,
    total: 100000,
    requests: 50,
	retries: 0,    
    responses: [{},{},{}],
    errors: [{},{},{}],
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

### 👨‍🔧️ configuration

your configuration is an object (or JSON) with the following structure:

```javascript
{
	dwh: "",			// warehouse name
	auth: {},			// warehouse auth details
	sql: "",			// a SQL query
	mappings: {},			// col headers → mixpanel fields
	mixpanel: {},			// mixpanel auth
	options: {},			// job options
	tags: {}			// arbitrary tags
}
```

you can find [examples](https://github.com/ak--47/dwh-mixpanel) in the repo for different warehouses. additionally, the module is typed using jsdoc, so you should have a good experience using it in your IDE:

<img src="https://aktunes.neocities.org/dwh-mixpanel/devxp.gif" alt="developer experience" width=500/>

here's a description of each of those keys (and values) mean

##### dwh

a string representing the data warehouse you're connecting too.

`bigquery`, `athena`, `snowflake`, `azure`, `salesforce`

##### auth

an object `{}` containing the service account/credentials to use when authenticating with the data warehouse.

each cloud warehouse has its _own_ method(s) of authenticating API calls, which usually consist of a username and a password, secret, or private key.

to read more about the ways you can authenticate with a supported data warehouse, see [warehouse details](#warehouse)

##### sql

a valid SQL Query to run (as a job) in your data warehouse; this is the "model" for the data that will be sent to mixpanel. your SQL query will usually be in the form of a `SELECT {fields}` or `SELECT *` statement:

```SQL
SELECT
  eventName,
  user_id,
  timestamp,
  prop_a,
  prop_b,
  prop_c,
  rowId as insert_id
FROM
  "myProject.myDB.myTable"
WHERE
  env is "prod"
```

your SQL query should produce a **flat, non-nested table that has the fields and records you wish to stream to mixpanel**. your column headers can have any title; you will provide a mappings dictionary (detailed below) to describe how mixpanel should receive the fields.

**note:** _most_ field labels can be retitled post-ingestion using [lexicon](https://help.mixpanel.com/hc/en-us/articles/360001307806-Lexicon-Overview#adding-or-changing-descriptions), mixpanel's data governance suite.

##### mappings

an object `{}` containing mapping assignments of COLUMN headers in the warehouse table to JSON property keys in [mixpanel's data model](https://developer.mixpanel.com/docs/data-structure-deep-dive#anatomy-of-an-event).

providing mappings is not a tedious task; mixpanel is a schemaless tool designed for semi-structured data, so **any column not explicitly mapped which is present in the table will become an event/user property key and value**.

therefore, your SQL query should select all the fields you want in mixpanel, and the only fields you must provide mappings for depend on the required fields for the type of data you're importing:

**event mappings**:

**NOTE:** this module supports [original id merge](https://help.mixpanel.com/hc/en-us/articles/9648680824852-ID-Merge-Implementation-Best-Practices) AND [simplified id merge](https://help.mixpanel.com/hc/en-us/articles/14377628688788-Getting-Started-with-the-Simplified-ID-Merge-API#distinct-id) ... there's an [FAQ](https://help.mixpanel.com/hc/en-us/articles/14383975110292-Original-vs-Simplified-ID-Merge-FAQ) which explains the differences, but usually **simplified id merge** is the best solve for rETL.

```javascript
{
  // REQUIRED
  'event_name_col': '', 	// column for event name
  'time_col': '', 		// column for event time

  // REQUIRED FOR ORIGINAL ID MERGE
   'distinct_id_col': '', 	// column for distinct_id

  // REQUIRED FOR SIMPLIFIED ID MERGE
   'user_id_col': '', 		// column for user_id / canonical_id
   'device_id_col': '', 	// column for device_id / anon_id

  // OPTIONAL
  'insert_id_col': '' 		// column for row id (deduplication)
}
```

note: `insert_id_col` is **required** when using [`strict` mode](https://developer.mixpanel.com/reference/import-events#validation)

**user or group profiles mappings**:

```javascript
{

// REQUIRED
 'distinct_id_col': '', // column for uniquer user id

// OPTIONAL
 'profileOperation': '', // the $set style operation to use
 'name_col': '', // column $name to use for the user/group profile
 'email_col': '', // column $email to use for the user/group profile
 'avatar_col': '', // column $email to use for the user/group profile
 'created_col': '', // column $created (timestamp) to use
 'phone_col': '', // column $phone to use for the user/group profile
 'latitude_col': '', // column $latitude to use for the user/group profile
 'longitude_col': '', // column $longitude to use for the user/group profile
 'ip_co': '' // column $ip to use for the user/group profile
}
```

**lookup tables mappings**:

```javascript
{
// REQUIRED
 'lookup_col' : '' //the "join" column for the lookup table
//hint: ^ this is usually the first column in the table
}
```

the key to remember about `mappings` is that you a giving the module a guide to understand how to map fields from your warehouse to required fields for the different mixpanel data types.

here's an example:

```SQL
SELECT
 	insert_id, timestamp, action, uuid, theme, class
FROM
	mydnd.campaign.db
```

which produces this table:
| insert_id | timestamp | action | uuid | theme | class |
|-----------|-----------|--------|-------|-------|---------|
| abc-123 | 4:19 PM | attack | ak | dark | cleric |
| xyz-345 | 4:20 PM | defend | alice | light | bard |
| cba-678 | 4:20 PM | attack | bob | light | paladin |
| zyx-901 | 4:21 PM | sneak | eve | dark | rogue |

with this mapping:

```javascript
{
	event_name_col: 'action',
	distinct_id_col: 'uuid',
	time_col: 'timestamp',
	insert_id_col: 'insert_id'
}
```

then produces these events in mixpanel:

```javascript
[
  {
    event: "attack",
    properties: {
      distinct_id: "ak",
      time: 1234567890,
      $insert_id: "abc-123",
      theme: "dark",
      class: "cleric",
    },
  },
  {
    event: "defend",
    properties: {
      distinct_id: "alice",
      time: 1234577891,
      $insert_id: "xyz-345",
      theme: "light",
      class: "bard",
    },
  },
  //etc...
];
```

for more info on mixpanel's data structure, [see this deep-dive](https://developer.mixpanel.com/docs/data-structure-deep-dive#anatomy-of-an-event)

##### mixpanel

an object `{}` containing authentication details used to connect to your mixpanel project.

```javascript
{
	project_id: '',  			//your mixpanel project id
	type: 'event',				//type of record to import
	region: 'US',				//or EU

	//one of service details OR api secret is required
	service_account: '',  			//service account user name
	service_secret: '', 			//service account secret

	api_secret: '',				//project api secret [deprecated]


	//required for profiles
 	token: '', 				//mixpanel project token

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

the `workers` option is important because it governs concurrency, which can greatly affect throughput. best results are observed between 10-20 workers.

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

### 📝 warehouse details

the data warehouse connectors used by this module are implemented as _middleware_, and therefore they have authentication strategies with different field requirements.

in most cases, `dwh-mixpanel` wraps the vendor SDKs of each warehouse with it's own API, so when passing `auth` params in your configuration, you can use any values that are supported by your warehouse, provided those credentials have the appropriate permissions.

below are details for authentication strategies and permissions required for in each supported warehouse. if you find an auth method or strategy that you need and is not supported for your warehouse, [please file an issue](https://github.com/ak--47/dwh-mixpanel/issues)

- [Google BigQuery](#bq)
- [AWS Athena](#athena)
- [Snowflake](#snowflake)
- [Microsoft Azure SQL](#azure)
- [Salesforce](#salesforce)

<div id="bq"></div>

##### BigQuery

most bigquery jobs will be authenticated with GCP [service accounts](https://cloud.google.com/iam/docs/service-accounts)

the service account will need the following permissions in bigquery AND on the specific dataset being queried:

- [`bigquery.jobs.create`](<https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=Run%20jobs%20(including%20queries)%20within%20the%20project.>)
- [`bigquery.jobs.get`](https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=Get%20data%20and%20metadata%20on%20any%20job.1)
- [`bigquery.datasets.get`](https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=Get%20metadata%20about%20a%20dataset.)
- [`bigquery.tables.get`](https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=out%20of%20BigQuery.-,bigquery.tables.get,-Get%20table%20metadata)
- [`bigquery.tables.getData`](https://cloud.google.com/bigquery/docs/access-control#bigquery.dataViewer:~:text=Get%20table%20data.%20This%20permission%20is%20required%20for%20querying%20table%20data.%0ATo%20get%20table%20metadata%2C%20you%20need%20bigquery.tables.get.)

in my experience, the `data viewer` + `bigquery job user` roles set together satisfies these cases; if a required permission is missing, the output will tell you what it is.

the typical fields used for auth are `project_id`, `private_key`, and `client_email`; `location` will need to be added manually based on the [region of your bigquery instance](https://cloud.google.com/bigquery/docs/locations):

```javascript
{
	dwh: "bigquery",
	auth : {
			"project_id": "my-gcp-project", //GCP project
			"client_email": "serviceAccount@email.com", //service acct email
			"private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",	// service account private key
			"location": "US" //bigquery location.. this is required!
		}
}
```

in most cases, you can [drop your exported JSON keys](https://cloud.google.com/iam/docs/creating-managing-service-accounts) into the `auth` param, and it will work. [here's a video](https://youtu.be/E6FeqVRVZjM) where i go through the service account setup, start to finish.

###### ADC Authentication

if you are running `dwh-mixpanel` from your local, and **you _do not_ have IAM access in GCP to create service accounts**, but you _do_ have user-level access to the datasets in BigQuery, you can use **[Application Default Credentials (ADC)](https://cloud.google.com/docs/authentication/provide-credentials-adc#local-dev)** which leverage _your_ local GCP account to authenticate with bigQuery's APIs.

the general steps here are:

- install the [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) and [initialize it](https://cloud.google.com/sdk/gcloud/reference/init)

```bash
gcloud init
```

- create [a credential file](https://cloud.google.com/docs/authentication/provide-credentials-adc#local-dev)

```bash
gcloud auth application-default login
```

- set your [configuration file's](#config) `auth` param to an empty object `{}`

```javascript
{
	"dwh": "bigquery",
	"auth": {},
	"sql": "SELECT * FROM FOO"
}
```

- run `dwh-mixpanel` with your updated [configuration file](#config):

```bash
npx dwh-mixpanel ./bigquery-mixpanel
```

<div id="snowflake"></div>

##### Snowflake

snowflake jobs with authenticate with a user name + password. you may also use [key pair auth](https://docs.snowflake.com/en/user-guide/key-pair-auth)

the fields used for auth are: 
- [`account` identifier](https://docs.snowflake.com/en/user-guide/admin-account-identifier.html) , 
- `username`, 
- `password` (or `privateKey`)
- [`warehouse`](https://docs.snowflake.com/en/sql-reference/sql/show-warehouses.html) name
- [`database`](https://docs.snowflake.com/en/sql-reference/sql/show-databases.html) name 
- [`schema`](https://docs.snowflake.com/en/sql-reference/sql/show-schemas.html) for your table

most of these values can be found in the UI or the SQL console.

```javascript
{
	dwh: "snowflake",
	auth : {
			// user + pass auth
			"username": "",
			"password": "",

			// key pair auth
			"username": "",
			"privateKey": "./path/to/rsa_key.p8"
			"passphrase": "my-passphrase" // for encrypted keys only

			// always required
			"account": "foobar.us-central1.gcp", // your snowflake identifier			
			"database": "PROD1", // database to use
			"schema": "PUBLIC", // schema to use
			"warehouse": "COMPUTE_WH" //warehouse to use
		}
}
```

no special permissions are required for snowflake - only that the user entered can view and query the dataset.

note: 2FA or SSO auth for Snowflake is _not_ currently supported in this module.

<div id="athena"></div>

##### Athena

to query athena from this module, your user account (or service account) will need permission to take the following actions in **athena**:

- [`StartQueryExecution`](https://docs.aws.amazon.com/athena/latest/APIReference/API_StartQueryExecution.html)
- [`GetQueryExecution`](https://docs.aws.amazon.com/athena/latest/APIReference/API_GetQueryExecution.html)
- [`GetQueryResults`](https://docs.aws.amazon.com/athena/latest/APIReference/API_GetQueryResults.html)
- [`GetQueryRuntimeStatistics`](https://docs.aws.amazon.com/athena/latest/APIReference/API_GetQueryRuntimeStatistics.html)

since athena _depends on_ **S3**, your account will _also_ need access to the following actions in **S3**:

- [`GetObject`](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html)
- [`DeleteObject`](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html)

the **S3** bucket you assign permissions to should be the same one **athena** uses for storage; you can see this in the athena UI:

<img src="https://aktunes.neocities.org/dwh-mixpanel/athenaLocation.png" alt="athena storage location" width=300/>

**note:** all queries made to athena are stored as CSV files in S3; this module uses the `DeleteObject` action to delete the materialized CSV after the data is imported into mixpanel.

most AWS accounts can be [setup for programmatic access](https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html#access-keys-and-secret-access-keys) using an `accessKeyId` and a `secretAccessKey`; you'll also need to add the `region` of your S3 instance.

```javascript
{
	dwh: "athena",
	auth : {
			"accessKeyId": "",
			"secretAccessKey": "",
			"region": "us-east-2" //note this is important!
		}
}
```

<div id="azure"></div>

##### Azure

Azure SQL (managed + on premise) servers employ usernames and passwords for authentication; there are no special permissions required... the user you authenticate as should have permissions to run the query.

there are two common patterns for entering credentials, **connection strings** and **JSON** ... they are essentially the same thing in different formats:

- **connection string**
  a connection string is a long string which contains username, password, database, port and some other options to establish a secure connection with your database. they look like this:

```
Server=tcp:my-sql-server.database.windows.net,1433;Database=database;User Id=username;Password=password;Encrypt=true
Driver=msnodesqlv8;Server=(local)\INSTANCE;Database=database;UID=DOMAIN\username;PWD=password;Encrypt=true
```

you can input your connection string into the `auth` object with the key `connection_string`:

```javascript
{
	dwh: "azure",
	auth: {
		connection_string: "my-sql-server.database.windows.net,1433; etc..."
	}
}
```

if your database is hosted in Azure Cloud, you can find your connection strings in the Azure SQL UI; this module uses the **ADO.NET** syntax:

<img src="https://aktunes.neocities.org/dwh-mixpanel/azureStrings.png" alt="azure cloud screenshot" width=620/>

make sure to choose the right connection string version that is supported by your database.
(hint: not all Azure DBs are setup with Active Directory)

- **JSON**

if you wish, you may also pass your credentials as JSON; the parameters are very similar to what's encoded in the connection string. they look like this:

```javascript
{
	dwh: "azure",
	auth: {
		user: "",
		password: "",
		server: "",
		port: 1433, //default
		domain: "",
		database: ""
	}
}
```

you can also pass other pool configuration options to the `auth` object... [see the full list of params](https://github.com/tediousjs/node-mssql#general-same-for-all-drivers)

<div id="salesforce"></div>

##### salesforce

while salesforce may not typically be thought of as a "data warehouse" (great for transactions; not so great for analysis), **it can be queried with SQL**. salesforce uses [SOQL](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm), a [variant of SQL for sObjects](https://builtin.com/data-science/soql). 

therefore, you can model events, profiles, groups or lookup tables as SOQL queries, and pipe them directly to mixpanel!

the [data model for salesforce](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/data_model.htm) is quite unique, and therefore this module works _differently_ when interfacing with salesforce than it does with other warehouses.

for authentication you need only add a `username` and `password` for the `auth` object:

```javascript
{
    dwh: "salesforce",
    auth: {
		user: "", //your username
		password: "", // your password + security token
		version: "51.0" // API version to use; 51 is default
    }
}
```

`dwh-mixpanel` uses salesforce's [SOAP login API](https://developer.salesforce.com/docs/atlas.en-us.242.0.api.meta/api/sforce_api_calls_login.htm#:~:text=To%20log%20in%2C%20the%20user%20must%20add%20the%20security%20token%20at%20the%20end%20of%20the%20user%E2%80%99s%20password.%20For%20example%2C%20if%20a%20user%27s%20password%20is%20mypassword%20and%20the%20security%20token%20is%20XXXXXXXXXX%2C%20the%20user%20enters%20mypasswordXXXXXXXXXX.) for authentication... this means your `password` is your normal salesforce password with a concatenated [security token](https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_concepts_security.htm). if your UI password was: `foo` and your security token was `bar-bazqux` your API password is `foobar-bazqux`

if you do not have a security token, [here are the steps to reset it](https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_concepts_security.htm)

this module provides **additional options** which govern the transformation of salesforce records into usable mixpanel entities; these options are all **turned on by default** and can be changed in the `auth` section of the [configuration file](#config) if desired:

```javascript
{
    dwh: "salesforce",
    auth: {
		user, 
		password,
		"resolve_field_names": true, // "Renewal_Date__c" → "Contract Renewal Date"
		"rename_primary_id" : true, // "Id" → "Account.Id"
		"add_sfdc_links": true // add salesforce URLs to all records
    }
}
```

- `resolve_field_names`
  with this option, `dwh-mixpanel` will query your salesforce objects' schema to transform the API fields (`Renewal_Date__c`) into human readable labels (`Contract Renewal Date`) which will be sent in mixpanel 
  <br/>

- `rename_primary_id`
  this option will turn the `Id` column header into `sObject.Id`; you can still reference it as `sObject.Id` or `Id` in your configuration file's mappings. SOQL queries of the form `SELECT Id ... FROM sObject` have a generic `Id` column can be a pain-point when joining records from different objects. 
  <br/>

- `add_sfdc_links`
  this option adds a `salesforce link` property to each mixpanel record, so you can easily jump from mixpanel to salesforce in one click!

###### profiles + tables

for **user profiles, group profiles,** and **lookup tables**, you must provide column mappings to mixpanel objects. relationship fields using the dot `.` syntax allow you to traverse objects, and are easy to reference:

for example:

```SQL
SELECT
	Account.Id,
	Account.Name,
	Account.Owner.Name, -- relationships
	Account.CSM__c.Name,
	Account.ARR__c,
	Account.NPS__c,
	Account.plan_type__c.monthly_spend__c -- custom fields
FROM
	Account
```

would (likely) use the following mappings:

```javascript
{
    dwh: "salesforce",
    mappings: {
		distinct_id_col: "Account.Id",
		name_col: "Account.Name",
		email_col: "Account.Owner.Name",
    },
	mixpanel: {
		type : "group",
		groupKey: "Account.Id" //important!
	}
}
```

this will produce group profiles for every account, using each account's `Id` as the `$group_id`

in some instances  it can be tedious to list every single field that you may wish to include on a salesforce object. salesforce does _not_ support `SELECT *` queries, but if you want to bring over all flattened properties from an object, `dwh-mixpanel` does support this syntax.

by example, here is a query + mappings which will create user profiles for all of your salesforce end users and bring in every field on the `User` object in salesforce:

```sql
SELECT * FROM User
```

and the corresponding mappings:

```json
 "mappings": {
        "distinct_id_col": "Id",
        "name_col": "Name",
        "email_col": "Email",        
        "profileOperation": "$set"
    },
```
please use this feature with care as it does not traverse [relationship fields](https://help.salesforce.com/s/articleView?id=sf.overview_of_custom_object_relationships.htm&type=5)

###### events: field history

modeling **events** from salesforce in mixpanel is a bit different; in most cases, you will want to model [field history objects](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_opportunityfieldhistory.htm) as events in mixpanel. these objects contain the "change tables" that describe the lifecycle of a salesforce object... when an object is created, or when it's field value change (i.e. an `Opportunity` changing `Stage`), it's _field history_ is updated..

to properly use this module, **every SOQL query modeling history MUST contain the fields**: 

`Field, NewValue, OldValue, CreatedDate`

these fields are used internally to determine the **event name**, **event time**, and **$insert_id** therefore, any mappings supplied to `event_name_col`, `time_col`, or `insert_id_col` **will be ignored**.

you **will** need to supply a mapping for `distinct_id_col` (usually the `Id` of the primary object being queried)

for example, we might query the `OpportunityFieldHistory` to get events for each "field change" on each opportunity:

```SQL
SELECT
	Id, DataType, Field, NewValue, OldValue, CreatedDate,
	Opportunity.Id, Opportunity.Name, Opportunity.Amount,
	Opportunity.Owner.Name, Opportunity.Account.Name
FROM
	OpportunityFieldHistory
```

and we might use the following mapping:

```javascript
{
    dwh: "salesforce",
    mappings: {
		event_name_col: "", // ignored!
		insert_id_col: "", // ignored!
		time_col: "",	// ignored!
		distinct_id_col: "Opportunity.Id", //important!

    },
	mixpanel: {
		type : "event"
	}
}
```

this would model all field changes to any opportunities as events in mixpanel, using the opportunity's `Id` as the `distinct_id` in mixpanel.

###### events: no history

you can also model events that do not contain history tables; keep in mind that you'll need to choose a `time_col` mapping, (usually `CreatedDate` or `LastModifiedDate`) which determine _when_ the event occurred. 

in these cases, you are effectively modeling and event which describes when a particular salesforce object was _created_ or _modified_, but keep in mind that your field values always contain the _most current version_ of that object's properties, not the values at the time the object was created.

this is still quote useful, since some many salesforce objects are created once and never modified; for example, we might model new `Tasks` or `Calls` as the following:

```SQL
-- modeling Tasks object as events
SELECT
	Id, Who.Id, Who.Name, Who.RecordType.SobjectType,
	What.Id, What.Name, What.RecordType.SobjectType,
	AccountId, CreatedDate, CreatedBy.Id, CreatedBy.Name
FROM
	Task
WHERE
	LastModifiedDate = Today
```

we  _need_ supply the `time_col`, `insert_id_col`, and `distinct_id_col`:

```javascript
{
    dwh: "salesforce",
    mappings: {
		event_name_col: "", // optional!
		insert_id_col: "Id", // important!
		time_col: "CreatedDate", //important!
		distinct_id_col: "Who.Id", //important!

    },
	mixpanel: {
		type : "event"
	}
}
```

the `event_name_col` is optional; if it is supplied, that **will be a hardcoded event name in mixpanel**:

```javascript
{
    mappings: {
		event_name_col: "task was created!"
	}
}
```
would produce:

```javascript
{
	event: "task was created!",
	properties: {}
}
```

if `event_name_col` is not supplied, event names will be created automatically based on the `sObject` that is being queried (in this case `task`).

note: [nested SOQL subqueries](https://developer.salesforce.com/forums/?id=906F00000008yH8IAI) are not currently supported for salesforce rETLs.

<div id="env"></div>

### 💾 environment variables

if you would prefer to store your authentication details as **environment variables** or in an `.env` file, you may do so. 

this module will find those values **provided they are correctly named**.

here is a sample of how environment variables can be used for mixpanel:

```env
MP_SERVICE_ACCOUNT=myServiceAcct
MP_SERVICE_SECRET=myServiceSecret
MP_API_SECRET=myAPISecret
MP_TOKEN=myToken
MP_LOOKUP_TABLE=myLookupTableId
```

for the warehouse auth, use the key `DWH_AUTH` and for the value use stringified JSON that you would pass to `auth` in the [configuration file](#config):

```env
DWH_AUTH='{
		"project_id": "ak-internal-tool-1613096051700",
		"private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
		"client_email": "mySerAcct@iam.google.com",
		"location": "US"
	}'
```

that's it for now. have fun!
