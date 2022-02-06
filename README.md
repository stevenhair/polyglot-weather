# polyglot-weather
Simple command line apps to fetch the weather

## Why
It's been a while since I learned a new programming language, and I thought that for 2022, I'd learn at least one new
one. I don't really do well with tutorials, so I decided to set myself a small project.

## The goal
Thw goal is to just write a simple command-line app to fetch the current weather at the current location. Here are the steps:

1. Read the API key for [freegeoip.app](https://freegeoip.app/) from an environment variable
2. Call FreeGeoIpAPI to get the coordinates of the current IP address
3. Call the [weather.gov API](https://www.weather.gov/documentation/services-web-api) to get the current weather
4. Optionally write the weather to a file (based on a command line argument)
5. Print the weather and exit

The idea here is that I'll get an introduction to various aspects of a programming language, including HTTP calls, parsing
JSON, CLI arguments, file I/O, and error handling. Those are pretty much the basics for being dangerous in a language.

## Support languages
* JavaScript
* TypeScript
