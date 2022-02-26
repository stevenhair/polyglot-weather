#!/usr/bin/env python3

import argparse
import asyncio
import logging
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Tuple, Optional

import aiohttp

logging.basicConfig(level=logging.INFO)

API_KEY = os.getenv('FREEGEOIP_API_KEY')
LOGGER = logging.getLogger('weather')


@dataclass
class Weather:
    location: str
    temperature: float
    temperature_unit: str
    wind_speed: str
    wind_direction: str
    short_forecast: str


def _exit_with_error(message: str) -> None:
    was_exception_thrown = sys.exc_info()[0] is not None
    LOGGER.exception(message, exc_info=was_exception_thrown)
    sys.exit(-1)


async def get_coordinates() -> Tuple[float, float]:
    url = f'https://api.freegeoip.app/json/?apikey={API_KEY}'
    LOGGER.debug(f'Fetching GeoIP data from {url}')

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            data = await response.json()

            if response.status == 200:
                return data['latitude'], data['longitude']
            else:
                message = data.get('message') or f'received {response.status}'
                _exit_with_error(f'Failed to get current location: {message}')


async def get_current_weather(coordinates: Tuple[float, float], units: str) -> Weather:
    metadata_url = f'https://api.weather.gov/points/{",".join([str(c) for c in coordinates])}'
    LOGGER.debug(f'Fetching NWS location metadata from {metadata_url}')

    async with aiohttp.ClientSession() as session:
        async with session.get(metadata_url) as response:
            data = await response.json()

            if response.status == 200:
                forecast_url = f'{data["properties"]["forecastHourly"]}?units={"si" if units == "metric" else "us"}'
                location = data['properties']['relativeLocation']['properties']
            else:
                message = data.get('message') or f'received {response.status}'
                _exit_with_error(f'Failed to fetch NWS location metadata: {message}')

        async with session.get(forecast_url) as response:
            data = await response.json()

            if response.status == 200:
                now = data['properties']['periods'][0]
            else:
                message = data.get('message') or f'received {response.status}'
                _exit_with_error(f'Failed to fetch NWS forecast: {message}')

    return Weather(
        location=f'{location["city"]}, {location["state"]}',
        temperature=now['temperature'],
        temperature_unit=now['temperatureUnit'],
        wind_speed=now['windSpeed'],
        wind_direction=now['windDirection'],
        short_forecast=now['shortForecast'],
    )


def get_output(weather: Weather) -> str:
    return f'Good {get_period_of_day()}! It is {weather.temperature}°{weather.temperature_unit} and ' \
           f'{weather.short_forecast.lower()} in { weather.location}.'


def get_period_of_day() -> str:
    current_hour = datetime.now().hour
    if current_hour < 12:
        return 'morning'
    elif current_hour < 17:
        return 'afternoon'
    else:
        return 'evening'


def write_output(output: str, filename: Optional[str]) -> None:
    if filename:
        try:
            with open(filename, 'w') as f:
                f.write(output)
        except:
            _exit_with_error('Failed to write file')
    else:
        print(output)


async def go(units: str, filename: Optional[str] = None, verbose: bool = False) -> None:
    if verbose:
        LOGGER.setLevel(logging.DEBUG)

    coordinates = await get_coordinates()
    weather = await get_current_weather(coordinates, units)
    output = get_output(weather)
    write_output(output, filename)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Display the weather for the current location')
    parser.add_argument(
        '--output',
        '-o',
        metavar='FILE',
        type=str,
        help='Write output to FILE instead of printing to STDOUT',
    )
    parser.add_argument(
        '--units',
        '-u',
        metavar='UNITS',
        choices=['metric', 'us'],
        default='us',
        help='Output weather in the specified units. "us" for US units (°F, mph, etc.) and "metric" for metric '
             'units (°C, kph, etc.). Default: us',
    )
    parser.add_argument('--verbose', '-v', action='store_true', help='Show more output')
    args = parser.parse_args()

    asyncio.run(go(units=args.units, filename=args.output, verbose=args.verbose))
