/*
-------------
JSDOC TYPINGS
-------------
*/

/**
 * @typedef {'biquery' | 'athena' | 'snowflake' | 'azure' | 'salesforce'}  SupportedWarehouses the data warehouses supported by this module
 */

/**
 * @typedef {'event' | 'user' | 'group' | 'table'}  SupportedRecords types of records that can be ingested by mixpanel
 */

/**
 * @typedef Params a job configuration
 * @prop {SupportedWarehouses} dwh type of warehouse
 * @prop {Object} auth auth details for warehouse
 * @prop {string} sql SQL query to run in warehouse
 * @prop {Mappings} mappings
 * @prop {Options} options
 * @prop {Mixpanel} mixpanel
 * @prop {Tags} tags
 */


/**
 * @typedef Mappings mappings of dwh columns to mixpanel fields
 * @prop {string} [event_name_col] column for event name
 * @prop {string} [distinct_id_col] column for uniquer user id
 * @prop {string} [time_col] column for event time
 * @prop {string} [insert_id_col] column for row id (deduplication)
 * @prop {string} [name_col] the $name to use for the user/group profile
 * @prop {string} [email_col] the $email to use for the user/group profile
 * @prop {string} [avatar_col] a public link to an image to be used as an $avatar for the user/group profile
 * @prop {string} [created_col] the $created (timestamp) to use for the user/group profile
 * @prop {string} [phone_col] the $phone to use for the user/group profile
 * @prop {string} [latitude_col] the $latitude to use for the user/group profile; mixpanel will geo-resolve the profile when this value is supplied
 * @prop {string} [longitude_col] the $longitude to use for the user/group profile; mixpanel will geo-resolve the profile when this value is supplied
 * @prop {string} [ip_co] the $ip to use for the user/group profile; mixpanel will geo-resolve the profile when this value is supplied 
 * @prop {string} [profileOperation] the $set style operation to use for creating/updating the profile
 * @prop {string} [lookup_col] the "join" column for the lookup table; usually the first column in the table
 */

/**
 * @typedef Options options to use for the job
 * @prop {string} logFile a local path to write log files to
 * @prop {boolean} verbose display verbose console output
 * @prop {boolean} strict use strict mode when sending data to mixpanel
 * @prop {boolean} compress compress data in transit
 * @prop {Number} workers number of concurrent workers to make requests to mixpanel
 */

/**
 * @typedef Mixpanel mixpanel auth details + configuration
 * @prop {string} project_id  mixpanel project id {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#project-id more info}
 * @prop {string} [service_account] mixpanel service account user name {@link https://developer.mixpanel.com/reference/service-accounts#managing-service-accounts more info}
 * @prop {string} [service_secret] mixpanel service account secret {@link https://developer.mixpanel.com/reference/service-accounts#managing-service-accounts more info}
 * @prop {string} [api_secret] mixpanel project api secret {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#api-secret more info}
 * @prop {string} [token] mixpanel project token {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#project-token more info}
 * @prop {'US' | 'EU'} region mixpanel project region {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#data-residency more info}
 * @prop {SupportedRecords} type kind of data to import {@link https://developer.mixpanel.com/docs/data-structure-deep-dive more info}
 * @prop {string} [groupKey] a group analytics key to use for profiles {@link https://help.mixpanel.com/hc/en-us/articles/360025333632-Group-Analytics#implementation more info}
 * @prop {string} [lookupTableId] the lookup table to replace {@link https://developer.mixpanel.com/reference/replace-lookup-table more info}
 */

/**
 * @typedef {Object.<string, string>} Tags arbitrary tags (k:v) to put on the data
 */


/**
 * @typedef Summary summary of stream job
 * @prop {MixpanelSummary} mixpanel
 * @prop {Object.<SupportedWarehouses, WarehouseSummary>}
 */

/**
 * @typedef MixpanelSummary
 * @prop {number} duration the full duration of the job in ms
 * @prop {string} human a human readable string of the full duration
 * @prop {number} eps the "events per second" when sending to mixpanel
 * @prop {number} rps the "requests per second" when sending to mixpanel
 * @prop {number} total the number of records processed from the warehouse
 * @prop {number} success the number of records that were successfully ingested
 * @prop {number} failed the number of records that failed to be ingested
 * @prop {number} retries the number of times a request was retried 
 * @prop {number} workers the number of concurrent workers sending requests to mixpanel
 * @prop {string} version the version of this module
 * @prop {SupportedRecords} recordType the type of record that was sent to mixpanel
 * @prop {Object[]} errors the error payloads from mixpanel
 * @prop {Object[]} responses the response payloads from mixpanel
 */

/**
 * @typedef WarehouseSummary
 * @prop {Object} job job metadata from the warehouse
 * @prop {Object} schema schema for the (usually temporary) table created as a result of the query
 * @prop {Object} sqlAnalysis an AST of the user-entered SQL Query
 * @prop {number} rows the number of rows in the table
 * @prop {Object} [table] additional metadata on the temporary table
 */

export const Types = {};