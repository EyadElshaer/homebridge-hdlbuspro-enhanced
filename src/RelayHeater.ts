import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { Device } from 'smart-bus';
import { HDLBusproHomebridge } from './HDLPlatform';
import { ABCDevice } from './ABC';

export class RelayHeater implements ABCDevice {
  private service: Service;
  private heaterState = {
    active: 0, // 0 = Off, 1 = On
    currentTemp: 20,
    targetTemp: 22,
  };

  // HDL MFH06.432 Specific Commands
  private readonly HDL_HEATER_CONTROL_CMD = 0xE3E0;
  private readonly HDL_TEMP_SET_CMD = 0xE3E1;
  private readonly HDL_STATUS_QUERY_CMD = 0xE3E3;

  constructor(
    private readonly platform: HDLBusproHomebridge,
    private readonly accessory: PlatformAccessory,
    private readonly name: string,
    private readonly controller: Device,
    private readonly device: Device,
    private readonly channel: number,
  ) {
    const Service = this.platform.Service;
    const Characteristic = this.platform.Characteristic;

    // Accessory Information
    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'HDL')
      .setCharacteristic(Characteristic.Model, 'MFH06.432')
      .setCharacteristic(Characteristic.SerialNumber, `HDL-HEATER-${this.channel}`);

    // Thermostat Service
    this.service = this.accessory.getService(Service.Thermostat) ||
      this.accessory.addService(Service.Thermostat);
    this.service.setCharacteristic(Characteristic.Name, name);

    // Setup Characteristics
    this.configureCharacteristics();
    this.setupEventListeners();
    this.initializeHeater();
  }

  private configureCharacteristics() {
    const Characteristic = this.platform.Characteristic;

    // Active State
    this.service.getCharacteristic(Characteristic.Active)
      .onGet(() => this.heaterState.active)
      .onSet((value) => this.setPowerState(value as number));

    // Temperature Characteristics
    this.service.getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({ minValue: 5, maxValue: 40, minStep: 0.5 })
      .onGet(() => this.heaterState.currentTemp);

    this.service.getCharacteristic(Characteristic.TargetTemperature)
      .setProps({ minValue: 15, maxValue: 35, minStep: 0.5 })
      .onGet(() => this.heaterState.targetTemp)
      .onSet((value) => this.setTargetTemperature(value as number));

    // Heating State Characteristics
    this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .onGet(() => this.heaterState.active ? 1 : 0);

    this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .setProps({ validValues: [0, 1] })
      .onGet(() => this.heaterState.active ? 1 : 0)
      .onSet((value) => this.setPowerState(value as number));
  }

  private setupEventListeners() {
    // Listen for status updates (MFH06.432 uses 0xE3E4 for broadcast)
    this.device.on(0xE3E4, (command) => {
      if (command.data.channel === this.channel) {
        this.updateFromStatus(command.data);
      }
    });
  }

  private initializeHeater() {
    // Query initial state
    this.controller.send({
      target: this.device,
      command: this.HDL_STATUS_QUERY_CMD,
      data: { channel: this.channel },
    }, (err, res) => {
      if (!err && res?.data) {
        this.updateFromStatus(res.data);
      }
    });
  }

  private updateFromStatus(data: any) {
    // Update power state
    if (data.power !== undefined) {
      this.heaterState.active = data.power ? 1 : 0;
      this.service.updateCharacteristic(
        this.platform.Characteristic.Active,
        this.heaterState.active,
      );
    }

    // Update temperatures (direct values, no scaling needed)
    if (data.currentTemp !== undefined) {
      this.heaterState.currentTemp = data.currentTemp;
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        this.heaterState.currentTemp,
      );
    }

    if (data.targetTemp !== undefined) {
      this.heaterState.targetTemp = data.targetTemp;
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetTemperature,
        this.heaterState.targetTemp,
      );
    }
  }

  private setPowerState(state: number) {
    this.controller.send({
      target: this.device,
      command: this.HDL_HEATER_CONTROL_CMD,
      data: {
        channel: this.channel,
        status: state ? 1 : 0,
      },
    }, (err) => {
      if (!err) {
        this.heaterState.active = state;
        this.platform.log.info(`Power state set to ${state ? 'ON' : 'OFF'}`);
      }
    });
  }

  private setTargetTemperature(temp: number) {
    this.controller.send({
      target: this.device,
      command: this.HDL_TEMP_SET_CMD,
      data: {
        channel: this.channel,
        temperature: temp,
      },
    }, (err) => {
      if (!err) {
        this.heaterState.targetTemp = temp;
        this.platform.log.info(`Target temperature set to ${temp}°C`);
      }
    });
  }
}