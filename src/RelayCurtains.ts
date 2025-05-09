/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { EventEmitter } from 'events';
import { Device } from 'smart-bus';

import { HDLBusproHomebridge } from './HDLPlatform';
import { ABCDevice, ABCListener } from './ABC';

const HMBOpening = 1;
const HMBClosing = 0;
const HMBStop = 2;

export class RelayCurtains implements ABCDevice {
  private service: Service;
  private RelayCurtainsStates = {
    PositionState: HMBStop,
    CurrentPosition: 0,
    TargetPosition: 0,
  };

  private postracker_process;
  private stopper_process;
  private HDLOpening = 1;
  private HDLClosing = 2;
  private HDLStop = 0;

  constructor(
    private readonly platform: HDLBusproHomebridge,
    private readonly accessory: PlatformAccessory,
    private readonly name: string,
    private readonly controller: Device,
    private readonly device: Device,
    private readonly listener: RelayCurtainListener,
    private readonly channel: number,
    private readonly nc: boolean,
    private readonly duration: number,
    private readonly precision: number,
  ) {
    const Service = this.platform.Service;
    const Characteristic = this.platform.Characteristic;

    // Initialize from persisted context
    this.RelayCurtainsStates.CurrentPosition = accessory.context.currentPosition ?? 0;
    this.RelayCurtainsStates.TargetPosition = accessory.context.targetPosition ?? 0;

    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'HDL');
    this.service = this.accessory.getService(Service.WindowCovering) || this.accessory.addService(Service.WindowCovering);
    this.service.setCharacteristic(Characteristic.Name, name);

    this.service.getCharacteristic(Characteristic.CurrentPosition)
      .onGet(this.handleCurrentPositionGet.bind(this));
    this.service.getCharacteristic(Characteristic.PositionState)
      .onGet(this.handlePositionStateGet.bind(this));
    this.service.getCharacteristic(Characteristic.TargetPosition)
      .onGet(this.handleTargetPositionGet.bind(this))
      .onSet(this.handleTargetPositionSet.bind(this));

    if (this.nc === false) {
      this.HDLOpening = 2;
      this.HDLClosing = 1;
      this.HDLStop = 0;
    }

    const eventEmitter = this.listener.getCurtainEventEmitter(this.channel);
    eventEmitter.on('update', (status) => {
      clearInterval(this.postracker_process);
      if (Math.abs(this.RelayCurtainsStates.CurrentPosition - this.RelayCurtainsStates.TargetPosition) <= this.precision) {
        this.RelayCurtainsStates.CurrentPosition = this.RelayCurtainsStates.TargetPosition;
        this.service.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.RelayCurtainsStates.CurrentPosition);
        this.saveCurrentPosition();
      }

      switch (status) {
        case this.HDLStop:
          clearInterval(this.postracker_process);
          clearTimeout(this.stopper_process);
          this.RelayCurtainsStates.TargetPosition = this.RelayCurtainsStates.CurrentPosition;
          this.service.getCharacteristic(Characteristic.TargetPosition).updateValue(this.RelayCurtainsStates.TargetPosition);
          this.RelayCurtainsStates.PositionState = HMBStop;
          this.service.getCharacteristic(Characteristic.PositionState).updateValue(this.RelayCurtainsStates.PositionState);
          this.platform.log.debug(`${this.name} stopped at ${this.RelayCurtainsStates.CurrentPosition}%`);
          this.saveCurrentPosition();
          this.saveTargetPosition();
          break;

        case this.HDLOpening:
          this.RelayCurtainsStates.PositionState = HMBOpening;
          this.service.getCharacteristic(Characteristic.PositionState).updateValue(this.RelayCurtainsStates.PositionState);
          this.postracker_process = setInterval(() => {
            if (this.RelayCurtainsStates.CurrentPosition < 100) {
              ++this.RelayCurtainsStates.CurrentPosition;
              this.service.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.RelayCurtainsStates.CurrentPosition);
              this.saveCurrentPosition();
            }
          }, 10 * this.duration);
          if (
            (this.RelayCurtainsStates.TargetPosition < this.RelayCurtainsStates.CurrentPosition) ||
            (this.RelayCurtainsStates.TargetPosition === 100) ||
            (this.RelayCurtainsStates.TargetPosition === 0 && this.RelayCurtainsStates.CurrentPosition === 0) ||
            (this.RelayCurtainsStates.TargetPosition === this.RelayCurtainsStates.CurrentPosition)
          ) {
            this.platform.log.debug('Starting full open of ' + this.name + ' (from ' + this.RelayCurtainsStates.CurrentPosition + ' to ' + this.RelayCurtainsStates.TargetPosition + ')');
            this.RelayCurtainsStates.TargetPosition = 100;
            this.service.getCharacteristic(Characteristic.TargetPosition).updateValue(this.RelayCurtainsStates.TargetPosition);
            this.saveTargetPosition();
          } else {
            this.platform.log.debug('Starting partial open of ' + this.name + ' (from ' + this.RelayCurtainsStates.CurrentPosition + ' to ' + this.RelayCurtainsStates.TargetPosition + ')');
            const pathtogo = this.RelayCurtainsStates.TargetPosition - this.RelayCurtainsStates.CurrentPosition;
            clearInterval(this.stopper_process);
            this.stopper_process = setTimeout(() => {
              this.controller.send({
                target: this.device,
                command: 0xE3E0,
                data: { curtain: this.channel, status: this.HDLStop },
              }, false);
              this.service.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.RelayCurtainsStates.CurrentPosition);
              this.platform.log.debug('Reached partial open position of ' + this.name + ' at ' + this.RelayCurtainsStates.TargetPosition);
              this.saveCurrentPosition();
            }, 1000 * (pathtogo / 100) * this.duration);
          }
          break;

        case this.HDLClosing:
          this.RelayCurtainsStates.PositionState = HMBClosing;
          this.service.getCharacteristic(Characteristic.PositionState).updateValue(this.RelayCurtainsStates.PositionState);
          this.postracker_process = setInterval(() => {
            if (this.RelayCurtainsStates.CurrentPosition > 0) {
              --this.RelayCurtainsStates.CurrentPosition;
              this.service.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.RelayCurtainsStates.CurrentPosition);
              this.saveCurrentPosition();
            }
          }, 10 * this.duration);
          if (
            (this.RelayCurtainsStates.TargetPosition > this.RelayCurtainsStates.CurrentPosition) ||
            (this.RelayCurtainsStates.TargetPosition === 0) ||
            (this.RelayCurtainsStates.TargetPosition === 100 && this.RelayCurtainsStates.CurrentPosition === 100) ||
            (this.RelayCurtainsStates.TargetPosition === this.RelayCurtainsStates.CurrentPosition)
          ) {
            this.platform.log.debug('Starting full close of ' + this.name + ' (from ' + this.RelayCurtainsStates.CurrentPosition + ' to ' + this.RelayCurtainsStates.TargetPosition + ')');
            this.RelayCurtainsStates.TargetPosition = 0;
            this.service.getCharacteristic(Characteristic.TargetPosition).updateValue(this.RelayCurtainsStates.TargetPosition);
            this.saveTargetPosition();
          } else {
            this.platform.log.debug('Starting partial close of ' + this.name + ' (from ' + this.RelayCurtainsStates.CurrentPosition + ' to ' + this.RelayCurtainsStates.TargetPosition + ')');
            const pathtogo = this.RelayCurtainsStates.CurrentPosition - this.RelayCurtainsStates.TargetPosition;
            clearInterval(this.stopper_process);
            this.stopper_process = setTimeout(() => {
              this.controller.send({
                target: this.device,
                command: 0xE3E0,
                data: { curtain: this.channel, status: this.HDLStop },
              }, false);
              this.service.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.RelayCurtainsStates.CurrentPosition);
              this.platform.log.debug('Reached partial close position of ' + this.name + ' at ' + this.RelayCurtainsStates.TargetPosition);
              this.saveCurrentPosition();
            }, 1000 * (pathtogo / 100) * this.duration);
          }
          break;
      }
    });

    // Query current state from hardware
    this.controller.send({
      target: this.device,
      command: 0xE3E2,
      data: { curtain: this.channel },
    }, false);
  }

  private saveCurrentPosition() {
    this.accessory.context.currentPosition = this.RelayCurtainsStates.CurrentPosition;
    this.platform.api.updatePlatformAccessories([this.accessory]);
  }

  private saveTargetPosition() {
    this.accessory.context.targetPosition = this.RelayCurtainsStates.TargetPosition;
    this.platform.api.updatePlatformAccessories([this.accessory]);
  }

  async handleTargetPositionSet(targetposition: CharacteristicValue) {
    const oldValue = this.RelayCurtainsStates.TargetPosition;
    this.RelayCurtainsStates.TargetPosition = targetposition as number;
    this.saveTargetPosition();

    const pathtogo = (targetposition as number) - this.RelayCurtainsStates.CurrentPosition;
    let command;
    switch (targetposition) {
      case 0:
        command = this.HDLClosing;
        this.platform.log.debug('Commanded a full close for ' + this.name);
        break;
      case 100:
        command = this.HDLOpening;
        this.platform.log.debug('Commanded a full open for ' + this.name);
        break;
      default:
        if (pathtogo < 0) {
          command = this.HDLClosing;
          this.platform.log.debug('Commanded a partial close for ' + this.name);
        } else if (pathtogo > 0) {
          command = this.HDLOpening;
          this.platform.log.debug('Commanded a partial open for ' + this.name);
        }
        break;
    }
    this.controller.send({
      target: this.device,
      command: 0xE3E0,
      data: { curtain: this.channel, status: command },
    }, (err) => {
      if (err) {
        this.RelayCurtainsStates.TargetPosition = oldValue;
        this.saveTargetPosition();
        this.platform.log.error(`Error setting TargetPosition state for ${this.name}: ${err.message}`);
      } else {
        this.platform.log.debug('Successfully sent command to ' + this.name);
      }
    });
  }

  async handleTargetPositionGet(): Promise<CharacteristicValue> {
    return this.RelayCurtainsStates.TargetPosition;
  }

  async handleCurrentPositionGet(): Promise<CharacteristicValue> {
    return this.RelayCurtainsStates.CurrentPosition;
  }

  async handlePositionStateGet(): Promise<CharacteristicValue> {
    return this.RelayCurtainsStates.PositionState;
  }
}

export class RelayCurtainListener implements ABCListener {
  private curtainsMap = new Map();
  private eventEmitter = new EventEmitter();

  constructor(
    private readonly device: Device,
    private readonly controller: Device,
  ) {
    this.device.on(0xE3E1, (command) => {
      const data = command.data;
      const curtain = data.curtain;
      const status = data.status;
      this.curtainsMap.set(curtain, status);
      this.eventEmitter.emit(`update_${curtain}`, status);
    });
    this.device.on(0xE3E3, (command) => {
      const data = command.data;
      const curtain = data.curtain;
      const status = data.status;
      this.curtainsMap.set(curtain, status);
      this.eventEmitter.emit(`update_${curtain}`, status);
    });
    this.device.on(0xE3E4, (command) => {
      const data = command.data;
      for (const curtainInfo of data.curtains) {
        const curtain = curtainInfo.number;
        const status = curtainInfo.status;
        this.curtainsMap.set(curtain, status);
        this.eventEmitter.emit(`update_${curtain}`, status);
      }
    });
  }

  getCurtainEventEmitter(curtain: number) {
    const eventEmitter = new EventEmitter();
    this.eventEmitter.on(`update_${curtain}`, (status) => {
      eventEmitter.emit('update', status);
    });
    return eventEmitter;
  }
}
