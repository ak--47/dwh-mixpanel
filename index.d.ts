/**
 * stream a SQL query from your data warehouse into mixpanel!
 * @example
 * const results = await dwhMixpanel(params)
 * console.log(results.mixpanel) // { duration: 3461, success: 420, responses: [], errors: [] }
 * @param {Params} params your streaming configuration
 * @returns {Promise<Summary>} summary of the job containing metadata about time/throughput/responses
 */
export default function main(params: Params): Promise<Summary>;


type ImportOptions = any;
/**
 * the data warehouses supported by this module
 */
type SupportedWarehouses = 'biquery' | 'athena' | 'snowflake' | 'azure' | 'salesforce';
/**
 * types of records that can be ingested by mixpanel
 */
type SupportedRecords = 'event' | 'user' | 'group' | 'table';
/**
 * a job configuration
 */
export type Params = {
    /**
     * type of warehouse
     */
    dwh: SupportedWarehouses;
    /**
     * auth details for warehouse
     */
    auth: any;
    /**
     * SQL query to run in warehouse
     */
    sql: string;
    mappings: Mappings;
    /**
     * Aliases property key names after mappings are applied `{sourceKey: targetKey}`
     */
    aliases: {
        [x: string]: string;
    };
    options: Options;
    mixpanel: Mixpanel;
    tags: Tags;
};
/**
 * mappings of dwh columns to mixpanel fields
 */
type Mappings = {
    /**
     * column for event name
     */
    event_name_col?: string;
    /**
     * column for distinct_id (original id merge)
     */
    distinct_id_col?: string;
    /**
     * column for user id (simplified id merge)
     */
    user_id_col?: string;
    /**
     * column for device_id / anon_id (simplified id merge)
     */
    device_id_col?: string;
    /**
     * column for event time
     */
    time_col?: string;
    /**
     * column for row id (deduplication)
     */
    insert_id_col?: string;
    /**
     * the $name to use for the user/group profile
     */
    name_col?: string;
    /**
     * the $email to use for the user/group profile
     */
    email_col?: string;
    /**
     * a public link to an image to be used as an $avatar for the user/group profile
     */
    avatar_col?: string;
    /**
     * the $created (timestamp) to use for the user/group profile
     */
    created_col?: string;
    /**
     * the $phone to use for the user/group profile
     */
    phone_col?: string;
    /**
     * the $latitude to use for the user/group profile; mixpanel will geo-resolve the profile when this value is supplied
     */
    latitude_col?: string;
    /**
     * the $longitude to use for the user/group profile; mixpanel will geo-resolve the profile when this value is supplied
     */
    longitude_col?: string;
    /**
     * the $ip to use for the user/group profile; mixpanel will geo-resolve the profile when this value is supplied
     */
    ip_co?: string;
    /**
     * the $set style operation to use for creating/updating the profile
     */
    profileOperation?: string;
    /**
     * the "join" column for the lookup table; usually the first column in the table
     */
    lookup_col?: string;
};
/**
 * options to use for the job
 */
type LocalOptions = {
    /**
     * a local path to write log files to
     */
    logFile: string;
    /**
     * display verbose console output
     */
    verbose: boolean;
    /**
     * use strict mode when sending data to mixpanel
     */
    strict: boolean;
    /**
     * compress data in transit
     */
    compress: boolean;
    /**
     * number of concurrent workers to make requests to mixpanel
     */
    workers: number;
};
type Options = LocalOptions & ImportOptions;
/**
 * mixpanel auth details + configuration
 */
type Mixpanel = {
    /**
     * mixpanel project id {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#project-id more info}
     */
    project_id: string;
    /**
     * mixpanel service account user name {@link https://developer.mixpanel.com/reference/service-accounts#managing-service-accounts more info}
     */
    service_account?: string;
    /**
     * mixpanel service account secret {@link https://developer.mixpanel.com/reference/service-accounts#managing-service-accounts more info}
     */
    service_secret?: string;
    /**
     * mixpanel project api secret {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#api-secret more info}
     */
    api_secret?: string;
    /**
     * mixpanel project token {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#project-token more info}
     */
    token?: string;
    /**
     * mixpanel project region {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#data-residency more info}
     */
    region: 'US' | 'EU';
    /**
     * kind of data to import {@link https://developer.mixpanel.com/docs/data-structure-deep-dive more info}
     */
    type: SupportedRecords;
    /**
     * a group analytics key to use for profiles {@link https://help.mixpanel.com/hc/en-us/articles/360025333632-Group-Analytics#implementation more info}
     */
    groupKey?: string;
    /**
     * the lookup table to replace {@link https://developer.mixpanel.com/reference/replace-lookup-table more info}
     */
    lookupTableId?: string;
};
/**
 * arbitrary tags (k:v) to put on the data
 */
type Tags = {
    [x: string]: string;
};
/**
 * summary of stream job
 */
export type Summary = {
    mixpanel: MixpanelSummary;
    "": any;
};
type MixpanelSummary = {
    /**
     * the full duration of the job in ms
     */
    duration: number;
    /**
     * a human readable string of the full duration
     */
    human: string;
    /**
     * the "events per second" when sending to mixpanel
     */
    eps: number;
    /**
     * the "requests per second" when sending to mixpanel
     */
    rps: number;
    /**
     * the number of records processed from the warehouse
     */
    total: number;
    /**
     * the number of records that were successfully ingested
     */
    success: number;
    /**
     * the number of records that failed to be ingested
     */
    failed: number;
    /**
     * the number of times a request was retried
     */
    retries: number;
    /**
     * the number of concurrent workers sending requests to mixpanel
     */
    workers: number;
    /**
     * the version of this module
     */
    version: string;
    /**
     * the type of record that was sent to mixpanel
     */
    recordType: SupportedRecords;
    /**
     * the error payloads from mixpanel
     */
    errors: any[];
    /**
     * the response payloads from mixpanel
     */
    responses: any[];
};
type WarehouseSummary = {
    /**
     * job metadata from the warehouse
     */
    job: any;
    /**
     * schema for the (usually temporary) table created as a result of the query
     */
    schema: any;
    /**
     * an AST of the user-entered SQL Query
     */
    sqlAnalysis: any;
    /**
     * the number of rows in the table
     */
    rows: number;
    /**
     * additional metadata on the temporary table
     */
    table?: any;
};
/**
 * stream a SQL query from your data warehouse into mixpanel!
 * @example
 * const results = await dwhMixpanel(params)
 * console.log(results.mixpanel) // { duration: 3461, success: 420, responses: [], errors: [] }
 * @param {Params} params your streaming configuration
 * @returns {Promise<Summary>} summary of the job containing metadata about time/throughput/responses
 */
declare function main(params: Params): Promise<Summary>;
