<span align="center">

# Homebridge HDL Buspro Enhanced
## HomeKit integration for HDL Buspro relays

</span>

`Homebridge-hdlbuspro-enhanced` is a homebridge plugin to control your devices on the HDL Buspro buses from Home app on iOS. It currently supports the following types of devices:

[![verified-by-homebridge](https://img.shields.io/badge/homebridge-verified-blueviolet?color=%23491F59&style=for-the-badge&logoColor=%23FFFFFF&logo=homebridge)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

### Features
* Relay Lightbulbs
* Relay Dimmable Lightbulbs
* Sensors 8 in 1 (dry contacts not supported yet)
* Dry contact relays
* Relay locks
* Relay curtains (including custom valve usage)
* Relay RGB
* Relay Fan

Heaters and security systems may be supported in later versions.

## Installation

If you are new to homebridge, please first read the homebridge [documentation](https://www.npmjs.com/package/homebridge).
If you are running on a Raspberry, you will find a tutorial in the [homebridge wiki](https://github.com/homebridge/homebridge/wiki/Install-Homebridge-on-Raspbian).

Install homebridge:

[Homebridge Installation](https://homebridge.io/how-to-install-homebridge)

Install homebridge-hdlbuspro-enhanced:
```sh
sudo npm i @elshaer/homebridge-hdl-buspro-enhanced
```

## Configuration

Add the `HDLBusproHomebridge` platform in `config.json` in your home directory inside `.homebridge`.

This plugin cannot discover devices on its own, for this you should use software like HDL Buspro setup tool v2 (you can download it [here](https://drive.google.com/file/d/1RGmIUSlMDCgXJxu58fNRzN3IgQXzq8gI/view?usp=sharing)). Use it to get info on your bus ip, port, its subnets, devices and all separate channels on relays to use these numbers in config with your custom names. You should also give a number for a virtual device on each subnet that will be used by plugin to send and receive commands and data on behalf of this plugin. Just choose whatever number is not occupied by other devices.

Typical HDL structure goes like this: **bus-subnet-device-channel**

Example configurations:

Relay Light Bulb:

```js
  {
            "buses": [
                "bus_name": "Main Bus",
                "bus_IP": "10.0.0.1",
                "bus_port": 6000
                {
                    "subnets": [
                        {
                            "subnet_number": 1,
                            "cd_number": 55,
                            "devices": [
                        {
                            "device_name": "Bedroom Lights",
                            "device_address": 5,
                            "device_type": "relaylightbulb",
                            "area": 1,
                            "channel": 2,
                        }
                    ]
                }
            ]
        }
    ]
    "platform": "HDLBusproHomebridge"
 }
```

Relay Dimmamble Light Bulb:

```js
  {
            "buses": [
                "bus_name": "Main Bus",
                "bus_IP": "10.0.0.1",
                "bus_port": 6000
                {
                    "subnets": [
                        {
                            "subnet_number": 1,
                            "cd_number": 55,
                            "devices": [
                        {
                            "device_name": "Bedroom Lights",
                            "device_address": 5,
                            "device_type": "relaydimmablelightbulb",
                            "area": 1,
                            "channel": 2,
                        }
                    ]
                }
            ]
        }
    ]
    "platform": "HDLBusproHomebridge"
  }
```

Sensor 8in1:

```js
  {
            "buses": [
                "bus_name": "Main Bus",
                "bus_IP": "10.0.0.1",
                "bus_port": 6000
                {
                    "subnets": [
                        {
                            "subnet_number": 1,
                            "cd_number": 55,
                            "devices": [
                        {
                            "device_name": "Dining room sensor",
                            "device_address": 21,
                            "device_type": "sensor8in1"
                        }
                    ]
                }
            ]
        }
    ]
    "platform": "HDLBusproHomebridge"
  }
```

Relay RGB:

```js
  {
            "buses": [
                "bus_name": "Main Bus",
                "bus_IP": "10.0.0.1",
                "bus_port": 6000
                {
                    "subnets": [
                        {
                            "subnet_number": 1,
                            "cd_number": 55,
                            "devices": [
                        {
                            "device_name": "Bedroom RGB Light",
                            "device_address": 9,
                            "device_type": "relayrgb",
                            "red_channel": 1,
                            "green_channel": 2,
                            "blue_channel": 3
                        }
                    ]
                }
            ]
        }
    ]
    "platform": "HDLBusproHomebridge"
  }
```

Relay Curtain:

```js
  {
            "buses": [
                "bus_name": "Main Bus",
                "bus_IP": "10.0.0.1",
                "bus_port": 6000
                {
                    "subnets": [
                        {
                            "subnet_number": 1,
                            "cd_number": 55,
                            "devices": [
                        {
                            "device_name": "Bedroom Fan",
                            "device_address": 5,
                            "device_type": "relayfan",
                            "channel": 1,
                        }
                    ]
                }
            ]
        }
    ]
    "platform": "HDLBusproHomebridge"
  }
```
Relay Fan:

```js
  {
            "buses": [
                "bus_name": "Main Bus",
                "bus_IP": "10.0.0.1",
                "bus_port": 6000
                {
                    "subnets": [
                        {
                            "subnet_number": 1,
                            "cd_number": 55,
                            "devices": [
                        {
                            "device_name": "Bedroom Curtain",
                            "device_address": 17,
                            "device_type": "relaycurtains",
                            "channel": 1,
                            "duration": 3.5,
                            "curtains_precision": 10
                        }
                    ]
                }
            ]
        }
    ]
    "platform": "HDLBusproHomebridge"
  }
```

### Parameters
#### Platform Configuration fields
- `platform` [required]
Should always be **"HDLBusproHomebridge"**.
- `buses` [required]
A list of your buses
#### Bus configuration fields
- `bus_name` [required]
Name of your bus.
- `bus_ip` [required]
ip address of your bus
- `port` [required]
port of your bus
- `subnets` [required]
A list of subnets on this bus
#### Subnet configuration fields
- `subnet_number` [required]
Separate number for each subnet
- `cd_number` [required]
Any unoccupied number on subnet to control your devices from
- `devices` [optional]
Add all devices on subnet you need
#### Device configuration fields
- `device_name` [optional]
Your custom name for device, will be shown in Home app by default
- `device_address` [required]
Number of device in subnet
- `device_type` [required]
Specify the type of device
  - Available values:
    - *"relaylightbulb"* - relay lights
    - *"relaydimmablelightbulb"* - relay dimmable lights
    - *"sensor8in1"* - multisensor
    - *"relaylock"* - custom use of light relay to control a lock
    - *"drycontact"* - dry contact relay
    - *"relaycurtains"* - relay curtains (have to be calibrated in HDL)
    - *"relaycurtainvalve"* - custom usage of curtains relay to control a water valve
    - *"relayrgb" - Control of your RGB light and exposed in HomeKit as RGB
    - *"relayfan" - Controls fans connected to HDL
- `channel` [optional]
Specify channel for a specific light group, curtains or dry contact of relay
- `area` [optional]
Needed for some dry contact relays
- `nc` [required]
You can flip the logic of dry contact relay or lock with this parameter
- `drycontact_type` [required]
Specify what your dry contact sensor does
  - Available values:
    - *"leaksensor"* - leak sensor
    - *"contactsensor"* - contact sensor
    - *"smokesensor"* - smoke sensor
    - *"occupancysensor"* - occupancy sensor
- `lock_timeout` [required]
An option to close lock automatically after specified time in seconds. Default is 0, which is usual lock behavior
- `duration` [required]
HDL can only control partial curtain opening by timer, so you have to calibrate how long it takes to fully open curtain, put this value to HDL and copy it here to avoid misalignment
- `curtains_precision` [required]
Due to a lag between HDL and HB curtain timers there has to be some precision offset, or it might get bugged in "opening" status. Increase this value if you encounter it.
- `valvetype` [required]
You can choose 4 valve types: "General Valve", "Irrigation", "Shower Head", "Water Faucet".
- `relayrgb_channels` [required]
To be able to use the RelayRGB you need to have access to the 3 colors channels (Red Green Blue) channels to be added to the homebridge and be exposed in HomeKit as a RGB bulb 



## Troubleshooting
If you have any issues with the plugin then you can run homebridge in debug mode, which will provide some additional information. This might be useful for debugging issues.

Please keep in mind that I could only test how plugin works on devices I have at home, and some devices were coded only based on documentation. So feel free to open issues [here](https://github.com//EyadElshaer/homebridge-hdlbuspro-enhanced/issues) if you encounter problems/need your device supported!

Homebridge debug mode:
```sh
homebridge -D
```


## Special thanks
[markbegma](https://github.com/markbegma/homebridge-hdl-buspro.git) For the wonderful work making all of this possible

[caligo-mentis](https://github.com/caligo-mentis/smart-bus) For his great work on Node.js remote control module for HDL Buspro.

[nvuln](https://github.com/nVuln/homebridge-hdl-buspro.git) For the great work on fixing the Relay Curtain Bug

[jainvandit99](https://github.com/jainvandit99) For his wonderful work with adding Relay Fan support