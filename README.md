# 🏭 dwh-mixpanel

Stream queries from your data warehouse to events, profiles, groups, or lookup tables in Mixpanel...  rETL style 💫. 

No intermediate staging/storage required.

Supported Data Warehouses:
- [Google BigQuery](#bq)
- [AWS Athena](#athena)
- [Snowflake](#snowflake)

## 👔 tldr;
run the module, and provide a [configuration file](#config) as the first argument:
```bash
npx dwh-mixpanel ./myConfig.json
```

for help building a [configuration file](#config), run the module with no arguments:
```bash
npx dwh-mixpanel ./myConfig.json
```

## 🍿 demo

### 👨‍💻️ cli

### 🔄 module

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



