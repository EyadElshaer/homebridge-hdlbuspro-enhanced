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
  private ignoreExternalUpdates = false;
  private updateTimeout: NodeJS.Timeout | null = null;
  private isRestoringState = false;

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
      this.isRestoringState = true;
      this.RGBState.Hue = this.lastColorState.Hue;
      this.RGBState.Saturation = this.lastColorState.Saturation;
      this.RGBState.Brightness = this.lastColorState.Brightness;

      // Immediate UI update
      this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.RGBState.Hue);
      this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.RGBState.Saturation);
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.RGBState.Brightness);
    } else if (!this.RGBState.On && wasOn) {
      this.lastColorState = {
        Hue: this.RGBState.Hue,
        Saturation: this.RGBState.Saturation,
        Brightness: this.RGBState.Brightness,
      };
    }

    this.service.updateCharacteristic(this.platform.Characteristic.On, this.RGBState.On);
    this.debouncedUpdate();
  }

  async getHue(): Promise<CharacteristicValue> {
    return this.RGBState.Hue;
  }

  async setHue(value: CharacteristicValue): Promise<void> {
    this.RGBState.Hue = value as number;
    this.updateColorState();
    this.debouncedUpdate();
  }

  async getSaturation(): Promise<CharacteristicValue> {
    return this.RGBState.Saturation;
  }

  async setSaturation(value: CharacteristicValue): Promise<void> {
    this.RGBState.Saturation = value as number;
    this.updateColorState();
    this.debouncedUpdate();
  }

  async getBrightness(): Promise<CharacteristicValue> {
    return this.RGBState.Brightness;
  }

  async setBrightness(value: CharacteristicValue): Promise<void> {
    this.RGBState.Brightness = value as number;
    this.updateColorState();
    this.debouncedUpdate();
  }

  private updateColorState(): void {
    this.lastColorState = { ...this.RGBState };
  }

  private debouncedUpdate(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(() => this.updateRGBLights(), 50);
  }

  private updateRGBLights(): void {
    if (!this.RGBState.On) {
      this.sendAtomicCommand([
        { channel: this.redChannel, level: 0 },
        { channel: this.greenChannel, level: 0 },
        { channel: this.blueChannel, level: 0 },
      ]);
      return;
    }

    const { r, g, b } = this.hsvToRgb(
      this.RGBState.Hue,
      this.RGBState.Saturation,
      this.RGBState.Brightness,
    );

    this.sendAtomicCommand([
      { channel: this.redChannel, level: r },
      { channel: this.greenChannel, level: g },
      { channel: this.blueChannel, level: b },
    ]);

    this.isRestoringState = false;
  }

  private sendAtomicCommand(commands: Array<{channel: number; level: number}>): void {
    this.ignoreExternalUpdates = true;

    commands.forEach(cmd => {
      if (cmd.channel === undefined) {
        return;
      }
      this.controller.send({
        target: this.device,
        command: 0x0031,
        data: { channel: cmd.channel, level: cmd.level },
      });
    });

    setTimeout(() => {
      this.ignoreExternalUpdates = false;
    }, 300); // Increased timeout for hardware response
  }

  private hsvToRgb(h: number, s: number, v: number) {
    h = Math.max(0, Math.min(360, h));
    s = Math.max(0, Math.min(100, s)) / 100;
    v = Math.max(0, Math.min(100, v)) / 100;

    if (s < 0.05) {
      const whiteLevel = Math.round(v * 100);
      return { r: whiteLevel, g: whiteLevel, b: whiteLevel };
    }

    const i = Math.floor(h / 60);
    const f = (h / 60) - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));

    let r, g, b;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
      default: r = 0; g = 0; b = 0;
    }

    return {
      r: Math.round(r * 100),
      g: Math.round(g * 100),
      b: Math.round(b * 100),
    };
  }

  private listenForExternalUpdates(): void {
    const createHandler = (color: 'red' | 'green' | 'blue') => (level: number) => {
      this.lastLevels[color] = level;
      this.handleExternalUpdate();
    };

    this.listener.getChannelEventEmitter(this.redChannel).on('update', createHandler('red'));
    this.listener.getChannelEventEmitter(this.greenChannel).on('update', createHandler('green'));
    this.listener.getChannelEventEmitter(this.blueChannel).on('update', createHandler('blue'));
  }

  private handleExternalUpdate(): void {
    if (this.ignoreExternalUpdates || this.isRestoringState) {
      return;
    }

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

    return {
      h: Math.round(h),
      s: Math.round(s),
      v: Math.round(v),
    };
  }
}