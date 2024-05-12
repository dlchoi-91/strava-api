const axios = require('axios');
const { ParameterizedQuery: PQ } = require('pg-promise');


//Oauth Flow Related Functions - Ultimately stravaOauthFlow() is used
async function getTokenStatus(db, owner_id) {
    //let sql = 'SELECT CASE WHEN to_timestamp(expires_at) <= NOW() THEN TRUE ELSE FALSE END AS token_expired, to_timestamp(expires_at), NOW() as now, access_token, refresh_token FROM api_data.oauth_tokens--WHERE owner_id = $1'
    let sql = 'SELECT expires_at, access_token, refresh_token FROM api_data.oauth_tokens WHERE owner_id = $1'
    return await db.one(sql, [owner_id]);
}

async function refreshStravaToken(client_id, client_secret, refresh_token) {
    const url = `https://www.strava.com/oauth/token?client_id=${client_id}&client_secret=${client_secret}&grant_type=refresh_token&refresh_token=${refresh_token}`;
    return await axios.post(url)
}

function writeStravaTokenDB(db, owner_id, token_type, access_token, expires_at, expires_in, refresh_token) {
    sql = "INSERT INTO api_data.oauth_tokens (owner_id, token_type, access_token, expires_at, expires_in, refresh_token) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ON CONSTRAINT owner_id_unq DO UPDATE SET access_token = $3, expires_at = $4, expires_in = $5;";
    const write_token = new PQ(sql);
    write_token.values = [owner_id, token_type, access_token, expires_at, expires_in, refresh_token];
    db.none(write_token);
}

async function stravaOauthFlow(db, owner_id, client_id, client_secret) {
    const token_status = await getTokenStatus(db, owner_id);
    let refresh_token = token_status.refresh_token
    let now = Date.now() / 1000; //compare at seconds
    if (now > token_status.expires_at) {
        console.log(`token expired for owner_id: ${owner_id}, refreshing token`)
        const strava_refresh = await refreshStravaToken(client_id, client_secret, refresh_token);
        writeStravaTokenDB(db, owner_id, strava_refresh.data.token_type, strava_refresh.data.access_token, strava_refresh.data.expires_at, strava_refresh.data.expires_in, strava_refresh.data.refresh_token);
        return strava_refresh.data.access_token;
    } else {
        console.log(`token was not expired for owner_id: ${owner_id}`)
        return token_status.access_token;
    }
}


//Functions related to Strava Activities - Ultimately recordStravaActivity() is used
async function getStravaActivity(object_id, access_token) {
    let object_str = object_id.toString();
    //validate object_str
    let regex = '[0-9]{11}';
    let regex_result = object_str.match(regex);
    if (regex_result[0] === object_str){
        let object_str_valid = object_str
        url = `https://www.strava.com/api/v3/activities/${object_str_valid}`;
        config = {
            headers: { Authorization: `Bearer ${access_token}` }
        };
        return await axios.get(url, config)
    } else {
        throw new Error("object id of activity did not meet pattern requirements");
    }

}

function writeActivityDB(db, object_id, owner_id, name, distance, moving_time, elapsed_time, sport_type, gear_id, total_elevation_gain, type, start_date, average_cadence, average_watts, average_heartrate) {
    let
        date_time = start_date.toString().split("T"),
        date = date_time[0],
        time = date_time[1].toString().split("Z")[0];

    dist_int = Math.round(distance);
    // sql_old = `INSERT INTO api_data.activities (object_id, owner_id, name, distance, moving_time, elapsed_time, sport_type, gear_id, total_elevation_gain, type, start_date, start_time, average_cadence, average_watts, average_heartrate) 
    //         VALUES (${object_id},${owner_id}, '${name}', ${distance}, ${moving_time}, ${elapsed_time}, '${sport_type}', '${gear_id}', ${total_elevation_gain}, '${type}', '${date}', '${time}', ${average_cadence}, ${average_watts}, ${average_heartrate})
    //         ON CONFLICT (object_id)
    //         DO
    //             UPDATE SET name = '${name}', gear_id = '${gear_id}', total_elevation_gain = ${total_elevation_gain}, start_date = '${date}', start_time = '${time}', average_cadence = ${average_cadence}, average_watts = ${average_watts}, average_heartrate = ${average_heartrate}; 
            // `;
    sql = `INSERT INTO api_data.activities (object_id, owner_id, name, distance, moving_time, elapsed_time, sport_type, gear_id, total_elevation_gain, type, start_date, start_time, average_cadence, average_watts, average_heartrate) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (object_id)
            DO
                UPDATE SET name = $3, gear_id = $8, total_elevation_gain = $9, start_date = $11, start_time = $12, average_cadence = $13, average_watts = $14, average_heartrate = $15; 
            `;
    const write_activity = new PQ(sql);
    console.log(`succesfully updated object_id: ${object_id}`);
    write_activity.values = [object_id , owner_id , name, dist_int, moving_time, elapsed_time, sport_type, gear_id, total_elevation_gain, type, date, time, average_cadence, average_watts, average_heartrate]
    db.none(write_activity);
    return;
}

async function recordStravaActivity(db, owner_id, client_id, client_secret, object_id) {
    const access_token = await stravaOauthFlow(db, owner_id, client_id, client_secret);
    const strava_act = await getStravaActivity(object_id, access_token);
    writeActivityDB(db, object_id, owner_id, strava_act.data.name, strava_act.data.distance, strava_act.data.moving_time, strava_act.data.elapsed_time, strava_act.data.sport_type, strava_act.data.gear_id, strava_act.data.total_elevation_gain, strava_act.data.type, strava_act.data.start_date, strava_act.data.average_cadence, strava_act.data.average_watts, strava_act.data.average_heartrate);
    return { access_token: access_token, gear_id: strava_act.data.gear_id };
}

//Functions related to Strava Gear
async function recordStravaGear(db, owner_id, gear_id, access_token) {
    let gear_str = gear_id.toString();
    let url = `https://www.strava.com/api/v3/gear/${gear_str}`;
    let config = {
        headers: { Authorization: `Bearer ${access_token}` }
    };
    let strava_gear = await axios.get(url, config);
    let
        results = strava_gear.data,
        primary = results.primary,
        resource_state = results.resource_state,
        distance = results.distance,
        brand_name = results.brand_name,
        model_name = results.model_name,
        frame_type = results.frame_type,
        description = results.description;
    console.log(`Updating gear data gear_id: ${gear_id}, brand_name: ${brand_name}, model_name: ${model_name}`)
    // sql_old = `INSERT INTO api_data.gear (gear_id, owner_id, "primary", resource_state, distance, brand_name, model_name, description) 
    //         VALUES ('${gear_id}', ${owner_id}, ${primary}, ${resource_state}, ${distance},'${brand_name}', '${model_name}', '${description}')
    //         ON CONFLICT ON CONSTRAINT gear_owner_unq
    //         DO
    //             UPDATE SET "primary" = ${primary}, resource_state = ${resource_state}, distance = ${distance}, brand_name = '${brand_name}', model_name = '${model_name}', description = '${description}';`;
    sql = `INSERT INTO api_data.gear (gear_id, owner_id, "primary", resource_state, distance, brand_name, model_name, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT ON CONSTRAINT gear_owner_unq
            DO
                UPDATE SET primary = $3, resource_state = $4, distance = $5, brand_name = $6, model_name = $7, description = $8;`;
    const write_gear = new PQ(sql);    
    write_gear.values = [gear_id, owner_id, primary, resource_state, distance, brand_name, model_name, description]
    db.none(sql);
    return {gear_id: gear_id};
}


module.exports = { recordStravaActivity, recordStravaGear };