/* eslint-disable no-unused-vars */
import dwhMp from "../index.js"

const result = await dwhMp({
	dwh: "athena",
	mixpanel: {
		project_id: 420,
		region: "US",
		type: "group"
	},
	mappings: {
		
	}
})