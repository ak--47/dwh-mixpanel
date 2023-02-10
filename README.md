# 🏭 dwh-mixpanel

Stream queries from your data warehouse to events, profiles, groups, or lookup tables in Mixpanel...  rETL style 💫. 

No intermediate staging/storage required.

Supported Data Warehouses:
- [Google BigQuery](#bq)
- [AWS Athena](#athena)
- [Snowflake](#snowflake)

## 👔 tldr; <div id="tldr"></div>
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

## 🍿 demo

todo

### 👨‍💻️ cli <div id="cli"></div>

as stated in the [tldr](#tldr), if you run `dwh-mixpanel` with no arguments you get a CLI which helps you build a [configuration file](#config):
```bash
npx dwh-mixpanel
```
yields: 

<img src="https://aktunes.neocities.org/dwh-mixpanel/cliWalk-sm.gif" alt="cli walkthrough">

at the end of this walkthrough, a JSON file will be saved to your current working directory. once you have a configuration file, you can run it using passing that file in as the first argument:

```bash
npx dwh-mixpanel snowflake-mixpanel.json
```
you'll get some console output as to the status of your job, and once it's complete it will stash the logs in the current working directory.

### 🔄 module <div id="module"></div>

`dwh-mixpanel` can also be used as a ESM module inside any node.js environment.

you use it as any other dependency:
```javascript
import dwhMp from 'dwh-mixpanel'
```

it exports a single function, which takes in a single parameter - a [configuration object](#config). 

this is the entry-point for the whole module:

```javascript
const myConfig = {
	dwh: "athena",
	sql: "SELECT * FROM EVENTS",
	//etc...
}

const athenaToMp = await dwhMp(myConfig)
```

the module returns a `summary` of the import job, with statistics and logs about how many records were processed.

### configuration<div id="config"></div>
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
here's a description of each of those keys (and values)

##### dwh
##### auth
##### sql
##### mappings
##### mixpanel
##### options
##### tags


### warehouse details

the data warehouse connectors used by this module are implemented as "middleware", and therefore they have different authentication strategies an dependencies.

below, i detail the most commonly used authentication methods for each supported warehouse, but if you find an auth method is not supported for a particular warehouse, [please file an issue](https://github.com/ak--47/dwh-mixpanel/issues)

##### BigQuery  <div id="bq"></div>

##### Snowflake <div id="snowflake"></div>

##### Athena <div id="athena"></div>


### environment variables



