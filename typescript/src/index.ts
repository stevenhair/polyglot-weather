#!/usr/bin/env ts-node
import axios from 'axios';
import { writeFile } from 'fs/promises';
import minimist from 'minimist';

type LogLevel = 'debug' | 'info' | 'error';
interface Weather {
    location: string,
    temperature: number,
    temperatureUnit: string,
    windSpeed: string,
    windDirection: string,
    shortForecast: string,
}

const API_KEY = process.env.IPBASE_API_KEY;

let verbose = false;

function isError(e: unknown): e is Error {
    return Object.prototype.hasOwnProperty.call(e, 'message') && Object.prototype.hasOwnProperty.call(e, 'stack');
}

function log(level: LogLevel, ...message: unknown[]): void {
    if (verbose || level !== 'debug') {
        console[level](...message);
    }
}

function exitWithError(message: string, error?: unknown): never {
    if (error) {
        if (isError(error)) {
            message += `: ${error.message}`;
            if (axios.isAxiosError(error)) {
                message += ` - ${error.response?.data}`;
            }
        } else {
            message += `: ${error}`;
        }
    }

    log('error', message);
    process.exit(1);
}

async function getCoordinates(): Promise<[number, number]> {
    const url = `https://api.ipbase.com/json/?apikey=${API_KEY}`;
    log('debug', `Fetching GeoIP data from ${url}`);

    try {
        const response = await axios.get(url);
        return [response.data.latitude, response.data.longitude];
    } catch (e) {
        exitWithError('Failed to get current location', e);
    }
}

async function getCurrentWeather(coordinates: [number, number], units: 'metric' | 'us'): Promise<Weather> {
    const metadataUrl = `https://api.weather.gov/points/${coordinates.join(',')}`;
    log('debug', `Fetching NWS location metadata from ${metadataUrl}`);

    let forecastUrl;
    let location;
    try {
        const response = await axios.get(metadataUrl);
        forecastUrl = `${response.data.properties.forecastHourly}?units=${units === 'metric' ? 'si' : 'us'}`;
        location = response.data.properties.relativeLocation.properties;
    } catch (e) {
        exitWithError(`Failed to fetch NWS location metadata`, e);
    }

    let now;
    log('debug', `Fetching NWS forecast from ${forecastUrl}`);
    try {
        const response = await axios.get(forecastUrl);
        now = response.data.properties.periods[0];
    } catch (e) {
        exitWithError('Failed to fetch NWS forecast', e);
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

function getPeriodOfDay(): 'morning' | 'afternoon' | 'evening' {
    const currentHour = new Date().getHours();

    if (currentHour < 12) {
        return 'morning';
    } else if (currentHour < 17) {
        return 'afternoon';
    } else {
        return 'evening';
    }
}

function getOutput(weather: Weather): string {
    return`Good ${getPeriodOfDay()}! It is ${weather.temperature}°${weather.temperatureUnit} and ` +
        `${weather.shortForecast.toLowerCase()} in ${weather.location}.`;
}

function printHelp(): void {
    console.log(`usage: ${process.argv[1]} [--units UNITS] [--output FILE]
Display the weather for the current location

Arguments:
  -h, --help            Show this message
  -o, --output FILE     Write output to FILE instead of printing to STDOUT
  -u, --units UNITS     Output weather in the specified units. "us" for US units (°F, mph, etc.) and "metric" for metric
                        units (°C, kph, etc.). Default: us
  -v, --verbose         Show more output
`);
}

function processArguments(): { output: string, units: 'metric' | 'us' } {
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

async function writeOutput(output: string, filename: string): Promise<void> {
    if (!filename) {
        console.log(output);
        return;
    }

    try {
        await writeFile(filename, output);
    } catch (e) {
        exitWithError('Failed to write file', e);
    }
}

const args = processArguments();
const coordinates = await getCoordinates();
const weather = await getCurrentWeather(coordinates, args.units);
const output = getOutput(weather);
await writeOutput(output, args.output);
