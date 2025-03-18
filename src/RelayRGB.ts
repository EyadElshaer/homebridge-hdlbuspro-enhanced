import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { Device } from 'smart-bus';
import { HDLBusproHomebridge } from './HDLPlatform';
import { RelayListener } from './RelayLightbulb';
import { ABCDevice } from './ABC';

export class RelayRGB implements ABCDevice {
  private service: Service;
  private RGBState = {
    On: false,
    Hue: 0,
    Saturation: 100,
    Brightness: 100,
  };

  private lastColorState = {
    Hue: 0,
    Saturation: 100,
    Brightness: 100,
  };

  private listener: RelayListener;
  private lastLevels = { red: 0, green: 0, blue: 0 };

  constructor(
    private readonly platform: HDLBusproHomebridge,
    private readonly accessory: PlatformAccessory,
    private readonly name: string,
    private readonly controller: Device,
    private readonly device: Device,
    private readonly redChannel: number,
    private readonly greenChannel: number,
    private readonly blueChannel: number,
  ) {
    const Service = this.platform.Service;
    const Characteristic = this.platform.Characteristic;

    this.service = this.accessory.getService(Service.Lightbulb) ||
                   this.accessory.addService(Service.Lightbulb);
    this.service.setCharacteristic(Characteristic.Name, name);

    this.service.getCharacteristic(Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    this.service.getCharacteristic(Characteristic.Hue)
      .onGet(this.getHue.bind(this))
      .onSet(this.setHue.bind(this));

    this.service.getCharacteristic(Characteristic.Saturation)
      .onGet(this.getSaturation.bind(this))
      .onSet(this.setSaturation.bind(this));

    this.service.getCharacteristic(Characteristic.Brightness)
      .onGet(this.getBrightness.bind(this))
      .onSet(this.setBrightness.bind(this));

    this.listener = new RelayListener(this.device, this.controller);
    this.listenForExternalUpdates();
  }

  async getOn(): Promise<CharacteristicValue> {
    return this.RGBState.On;
  }

  async setOn(value: CharacteristicValue): Promise<void> {
    const wasOn = this.RGBState.On;
    this.RGBState.On = value as boolean;

    if (this.RGBState.On && !wasOn) {
      // Restore last color state when turning on
      this.RGBState.Hue = this.lastColorState.Hue;
      this.RGBState.Saturation = this.lastColorState.Saturation;
      this.RGBState.Brightness = this.lastColorState.Brightness;
    } else if (!this.RGBState.On && wasOn) {
      // Save color state when turning off
      this.lastColorState = {
        Hue: this.RGBState.Hue,
        Saturation: this.RGBState.Saturation,
        Brightness: this.RGBState.Brightness,
      };
    }

    this.updateRGBLights();
  }

  async getHue(): Promise<CharacteristicValue> {
    return this.RGBState.Hue;
  }

  async setHue(value: CharacteristicValue): Promise<void> {
    this.RGBState.Hue = value as number;
    this.updateColorState();
    this.updateRGBLights();
  }

  async getSaturation(): Promise<CharacteristicValue> {
    return this.RGBState.Saturation;
  }

  async setSaturation(value: CharacteristicValue): Promise<void> {
    this.RGBState.Saturation = value as number;
    this.updateColorState();
    this.updateRGBLights();
  }

  async getBrightness(): Promise<CharacteristicValue> {
    return this.RGBState.Brightness;
  }

  async setBrightness(value: CharacteristicValue): Promise<void> {
    this.RGBState.Brightness = value as number;
    this.updateColorState();
    this.updateRGBLights();
  }

  private updateColorState(): void {
    if (this.RGBState.On) {
      this.lastColorState = {
        Hue: this.RGBState.Hue,
        Saturation: this.RGBState.Saturation,
        Brightness: this.RGBState.Brightness,
      };
    }
  }

  private updateRGBLights(): void {
    if (!this.RGBState.On) {
      this.sendRelayCommand(this.redChannel, 0);
      this.sendRelayCommand(this.greenChannel, 0);
      this.sendRelayCommand(this.blueChannel, 0);
      return;
    }

    let { r, g, b } = this.hsvToRgb(this.RGBState.Hue, this.RGBState.Saturation, this.RGBState.Brightness);

    // Preserve color even at low saturation
    if (this.RGBState.Saturation < 10) {
      const whiteLevel = this.RGBState.Brightness;
      r = whiteLevel;
      g = whiteLevel;
      b = whiteLevel;
    }

    this.sendRelayCommand(this.redChannel, r);
    this.sendRelayCommand(this.greenChannel, g);
    this.sendRelayCommand(this.blueChannel, b);
  }

  private sendRelayCommand(channel: number, level: number): void {
    if (channel === undefined) {
      return;
    }

    this.controller.send({
      target: this.device,
      command: 0x0031,
      data: { channel, level },
    }, (err) => {
      if (err) {
        this.platform.log.error(`Error setting channel ${channel} for ${this.name}: ${err.message}`);
      }
    });
  }

  private hsvToRgb(h: number, s: number, v: number) {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;

    if (h < 60) {
      r = c; g = x;
    } else if (h < 120) {
      r = x; g = c;
    } else if (h < 180) {
      g = c; b = x;
    } else if (h < 240) {
      g = x; b = c;
    } else if (h < 300) {
      r = x; b = c;
    } else {
      r = c; b = x;
    }

    return {
      r: Math.round((r + m) * 100),
      g: Math.round((g + m) * 100),
      b: Math.round((b + m) * 100),
    };
  }

  private listenForExternalUpdates(): void {
    const createUpdateHandler = (color: 'red' | 'green' | 'blue') => (level: number) => {
      this.lastLevels[color] = level;
      this.handleExternalUpdate();
    };

    this.listener.getChannelEventEmitter(this.redChannel).on('update', createUpdateHandler('red'));
    this.listener.getChannelEventEmitter(this.greenChannel).on('update', createUpdateHandler('green'));
    this.listener.getChannelEventEmitter(this.blueChannel).on('update', createUpdateHandler('blue'));
  }

  private handleExternalUpdate(): void {
    const { h, s, v } = this.rgbToHsv(
      this.lastLevels.red,
      this.lastLevels.green,
      this.lastLevels.blue,
    );

    this.RGBState.On = v > 0;
    this.RGBState.Brightness = v;

    if (this.RGBState.On) {
      this.RGBState.Hue = h;
      this.RGBState.Saturation = s;
      this.lastColorState = { Hue: h, Saturation: s, Brightness: v };
    }

    this.service.updateCharacteristic(this.platform.Characteristic.On, this.RGBState.On);
    this.service.updateCharacteristic(this.platform.Characteristic.Brightness, v);

    if (this.RGBState.On) {
      this.service.updateCharacteristic(this.platform.Characteristic.Hue, h);
      this.service.updateCharacteristic(this.platform.Characteristic.Saturation, s);
    }
  }

  private rgbToHsv(r: number, g: number, b: number) {
    r /= 100;
    g /= 100;
    b /= 100;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) {
        h += 360;
      }
    }

    const s = max === 0 ? 0 : (delta / max) * 100;
    const v = max * 100;

    return { h, s, v };
  }
}