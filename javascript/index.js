#!/usr/bin/env node
import axios from 'axios';

const API_KEY = process.env.FREEGEOIP_API_KEY;
const LOG_LEVEL = process.env.LOGLEVEL ?? 'info';

const logLevels = ['debug', 'info', 'warn', 'error'];
const currentLogLevel = logLevels.indexOf(LOG_LEVEL);

function log(level, ...message) {
    if (logLevels.indexOf(level) >= currentLogLevel) {
        console[level](...message);
    }
}

function exitWithError(message) {
    log('error', message);
    process.exit(1);
}

async function getCoordinates() {
    const url = `https://api.freegeoip.app/json/?apikey=${API_KEY}`;
    log('debug', `Fetching GeoIP data from ${url}`);

    try {
        const response = await axios.get(url);
        return [response.data.latitude, response.data.longitude];
    } catch (e) {
        exitWithError(`Failed to get current location: ${e.message}`);
    }
}

async function getCurrentWeather(coordinates) {
    const metadataUrl = `https://api.weather.gov/points/${coordinates.join(',')}`;
    log('debug', `Fetching NWS location metadata from ${metadataUrl}`);

    let forecastUrl;
    let location;
    try {
        const response = await axios.get(metadataUrl);
        forecastUrl = response.data.properties.forecastHourly;
        location = response.data.properties.relativeLocation.properties;
    } catch (e) {
        exitWithError(`Failed to fetch NWS location metadata`, e.message);
    }

    let now;
    log('debug', `Fetching NWS forecast from ${forecastUrl}`);
    try {
        const response = await axios.get(forecastUrl);
        now = response.data.properties.periods[0];
    } catch (e) {
        exitWithError(`Failed to fetch NWS location metadata`, e.message);
    }

    return {
        location: `${location.city}, ${location.state}`,
        temperature: now.temperature,
        temperatureUnit: now.temperatureUnit,
        windSpeed: now.windSpeed,
        windDirection: now.windDirection,
        shortForecast: now.shortForecast,
    };
}

function getPeriodOfDay() {
    const currentHour = new Date().getHours();

    if (currentHour < 12) {
        return 'morning';
    } else if (currentHour < 17) {
        return 'afternoon';
    } else {
        return 'evening';
    }
}

function getOutput(weather) {
    return`Good ${getPeriodOfDay()}! It is ${weather.temperature}°${weather.temperatureUnit} and ` +
        `${weather.shortForecast.toLowerCase()} in ${weather.location}.`;
}

const coordinates = await getCoordinates();
const weather = await getCurrentWeather(coordinates);
console.log(getOutput(weather));
