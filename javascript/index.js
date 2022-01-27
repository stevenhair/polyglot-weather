#!/usr/bin/env node
import axios from 'axios';
import { writeFile } from 'fs/promises';
import minimist from 'minimist';

const API_KEY = process.env.FREEGEOIP_API_KEY;

let verbose = false;

function log(level, ...message) {
    if (verbose || level !== 'debug') {
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

async function getCurrentWeather(coordinates, units) {
    const metadataUrl = `https://api.weather.gov/points/${coordinates.join(',')}`;
    log('debug', `Fetching NWS location metadata from ${metadataUrl}`);

    let forecastUrl;
    let location;
    try {
        const response = await axios.get(metadataUrl);
        forecastUrl = `${response.data.properties.forecastHourly}?units=${units === 'metric' ? 'si' : 'us'}`;
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

function printHelp() {
    console.log(`usage: ${process.argv[1]} [--units UNITS] [--output FILENAME]
Display the weather for the current location

Arguments:
  -h, --help            Show this message
  -o, --out FILE        Write output to FILE instead of printing to STDOUT
  -u, --units UNITS     Output weather in the specified units. "us" for US units (°F, mph, etc.) and "metric" for metric
                        units (°C, kph, etc.). Default: us
  -v, --verbose         Show more output
`);
}

function processArguments() {
    const args = minimist(process.argv.slice(2));

    if (args.h || args.help) {
        printHelp();
        process.exit();
    }

    verbose = !!(args.v || args.verbose);

    const processed = {
        output: args.o ?? args.output,
        units: args.u ?? args.units ?? 'us',
    };

    if (!['us', 'metric'].includes(processed.units)) {
        exitWithError(`"${processed.units}" is not a valid choice for units`);
    }

    return processed;
}

async function writeOutput(output, filename) {
    if (!filename) {
        console.log(output);
    }

    try {
        await writeFile(filename, output);
    } catch (e) {
        exitWithError(`Failed to write file: ${e.message}`);
    }
}

const args = processArguments();
const coordinates = await getCoordinates();
const weather = await getCurrentWeather(coordinates, args.units);
const output = getOutput(weather);
await writeOutput(output, args.output);
