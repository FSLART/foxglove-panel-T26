
Import this inside the Settings Panel (no need for manual insertion ) :  

Shutdowns:
```python
{
  "paths": {
    "RES": "/can/shutdown.RES",
    "botsShutdown": "/can/shutdown.botsShutdown",
    "inertiaSwitch": "/can/shutdown.inertiaSwitch",
    "emergencyPushCockpit": "/can/shutdown.emergencyPushCockpit",
    "rightEmergencyButton": "/can/shutdown.rightEmergencyButton",
    "sidePanelInterlock": "/can/shutdown.sidePanelInterlock",
    "leftEmergencyButton": "/can/shutdown.leftEmergencyButton",
    "junctionBoxInterlock": "/can/shutdown.junctionBoxInterlock",
    "ACU": "/can/shutdown.ACU"
  },
  "foxglovePanelTitle": ""
}
```

Springs:
```python
{
  "springPaths": {
    "FRONT_LEFT": "/can/springs.FL",
    "FRONT_RIGHT": "/can/springs.FR",
    "REAR_LEFT": "/can/springs.RL",
    "REAR_RIGHT": "/can/springs.RR"
  },
  "wheelSpeedPaths": {
    "FRONT_LEFT": "/can/wheels/speed.FL",
    "FRONT_RIGHT": "/can/wheels/speed.FR",
    "REAR_LEFT": "/can/wheels/speed.RL",
    "REAR_RIGHT": "/can/wheels/speed.RR"
  }
}
```