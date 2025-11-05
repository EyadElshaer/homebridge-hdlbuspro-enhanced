# Changelog

## 1.2.11
### [UPDATED]

* Updated PayPal Suppport Link

## 1.2.10
### [NEW]

* Verified By Homebridge!

## 1.2.9
### [NEW]

* Added Support For RelayFan. Thanks to @jainvandit99 & @markbegma

### [BUG-FIX]

* When trying to add HDLBusProEnhanced with no buses it keeps on boot looping

## v1.2.8

* [BUG-FIX] "Accessory Is Out Of Compliance" when trying to add to HomeKit with multiple Relay Light Bulbs

## v1.2.1

### [NEW]

* Update status of relay curtain if stopped mid opening/closing to the specific amount of opening
* When Homebridge restart the status of the Relay Curtain stays as it is, doesn't return to close
* Added support for RGB
* Added Support for Homebridge 2.0 Readlines
* RGB remembers the last color you had to choose it when you turn it on the next time

### [BUG-FIX]

* Fix Relay Curtain stopping when controlled from any outside controller
* Fix adding Channel id in the config UI for Relay Curtain
* Fix Relay Curtain gets stuck at opening or closing when stopping mid opening/closing
* Fix Relay Curtain when putting the relay curtain into a certain precentage it blocks the hardware button
* Fix RGB flickering when trying to choose white color

### [FUTURE PLANS]

* Maybe adding Support for Floor Heater Support soon

### [TIP]

* Make sure to put how much time it takes to fully close/open in the Duration to be able to use all of the new features