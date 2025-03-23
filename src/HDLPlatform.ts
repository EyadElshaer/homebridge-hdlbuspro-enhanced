/* eslint-disable @typescript-eslint/no-explicit-any */
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import SmartBus = require('smart-bus');
import { Bus, Device } from 'smart-bus';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { DeviceType, deviceTypeMap } from './DeviceList';
import { ABCDevice, ABCListener } from './ABC';
import { RelayHeater } from './RelayHeater';
import { RelayRGB } from './RelayRGB';

export class HDLBusproHomebridge implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  discoverDevices() {
    if (!Array.isArray(this.config.buses)) {
      this.log.error(`Plugin configuration error: "buses" must be a valid array in your config.json. Current value: ${JSON.stringify(this.config.buses)}`);
      return;
    }

    for (const bus of this.config.buses) {
      const ip: string = bus.bus_IP;
      const port: number = bus.bus_port;
      const busObj: Bus = new SmartBus({
        gateway: ip,
        port: port,
      });

      for (const subnet of bus.subnets) {
        const subnet_number: number = subnet.subnet_number;
        const cd_number: number = subnet.cd_number;
        const controllerObj: Device = busObj.controller(`${subnet_number}.${cd_number}`);
        const addressedDeviceMap = new Map();
        const uniqueIDPrefix = `${ip}:${port}.${subnet_number}`;

        for (const device of subnet.devices) {
          this.discoverDevice(busObj, subnet_number, device, uniqueIDPrefix, controllerObj, addressedDeviceMap);
        }
      }
    }
  }

  discoverDevice(
    busObj: Bus,
    subnet_number: number,
    device: any,
    uniqueIDPrefix: string,
    controllerObj: Device,
    addressedDeviceMap: Map<any, any>,
  ) {
    const deviceAddress = `${subnet_number}.${device.device_address}`;
    const deviceType: string = (device.device_type === 'drycontact') ? device.drycontact_type : device.device_type;

    this.log.info(`🔍 Discovering Device: ${device.device_name}, Type: ${deviceType}, Address: ${deviceAddress}`);
    this.log.info('🔍 Raw Device Data:', JSON.stringify(device, null, 2));

    if (deviceType === 'relayrgb') {
      this.handleRGBDevice(device, deviceAddress, uniqueIDPrefix, busObj, controllerObj);
      return;
    }

    const deviceTypeConfig: DeviceType<any, any> = deviceTypeMap[deviceType];
    if (!deviceTypeConfig) {
      this.log.error(`Invalid device type: ${deviceType}`);
      return;
    }

    const { deviceClass, listener, uniqueArgs, idEnding } = deviceTypeConfig;
    const uniqueID = `${uniqueIDPrefix}.${device.device_address}.${idEnding(device)}`;
    const uuid: string = this.api.hap.uuid.generate(uniqueID);

    let deviceObj: ABCDevice;
    let listenerObj: ABCListener;

    if (addressedDeviceMap.has(deviceAddress)) {
      ({ deviceObj, listenerObj } = addressedDeviceMap.get(deviceAddress));
    } else {
      deviceObj = busObj.device(deviceAddress);
      listenerObj = new listener(deviceObj, controllerObj);
      addressedDeviceMap.set(deviceAddress, { deviceObj, listenerObj });
    }

    const commonArgs = [device.device_name, controllerObj, deviceObj, listenerObj];
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    this.buildDevice(existingAccessory, deviceClass, commonArgs, uniqueArgs(device), uuid);
  }

  private handleRGBDevice(
    device: any,
    deviceAddress: string,
    uniqueIDPrefix: string,
    busObj: Bus,
    controllerObj: Device,
  ) {
    this.log.info(`Found RGB Light Device: ${device.device_name} at Address ${deviceAddress}`);

    const redChannel = device.red_channel;
    const greenChannel = device.green_channel;
    const blueChannel = device.blue_channel;

    if (redChannel === undefined || greenChannel === undefined || blueChannel === undefined) {
      this.log.error(`RGB Channels Undefined for ${device.device_name} - Check Configuration`);
      return;
    }

    this.log.info(`Assigned RGB Channels - Red: ${redChannel}, Green: ${greenChannel}, Blue: ${blueChannel}`);

    const uuid: string = this.api.hap.uuid.generate(
      `${uniqueIDPrefix}.${device.device_address}.rgb.${redChannel}-${greenChannel}-${blueChannel}`,
    );

    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      this.log.info(`Restoring existing RGB accessory: ${device.device_name}`);
      new RelayRGB(
        this,
        existingAccessory,
        device.device_name,
        controllerObj,
        busObj.device(deviceAddress),
        redChannel,
        greenChannel,
        blueChannel,
      );
    } else {
      this.log.info(`Creating new RGB accessory: ${device.device_name}`);
      const accessory = new this.api.platformAccessory(device.device_name, uuid);
      accessory.context.device = device;

      new RelayRGB(
        this,
        accessory,
        device.device_name,
        controllerObj,
        busObj.device(deviceAddress),
        redChannel,
        greenChannel,
        blueChannel,
      );

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }

  private buildDevice(
    accessory: PlatformAccessory | undefined,
    deviceClass: new (...args: any[]) => ABCDevice,
    commonArgs: any[],
    uniqueArgs: any[],
    uuid: string,
  ) {
    if (accessory) {
      this.log.info('Restoring existing accessory from cache:', accessory.displayName);
    } else {
      this.log.info('Adding new accessory:', commonArgs[0]);
      accessory = new this.api.platformAccessory(commonArgs[0], uuid);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    new deviceClass(this, accessory, ...commonArgs, ...uniqueArgs);
  }
}
