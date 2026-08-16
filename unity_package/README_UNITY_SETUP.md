# 🎮 Pizza Ready! 3D Tycoon - Unity C# Migration & Setup Guide

This package provides a clean, 1-to-1 production architecture mapping the web 3D tycoon game directly to **Unity (Universal Render Pipeline / URP)**.

---

## 📁 Package Architecture

All scripts are located in `unity_package/Scripts/` and use the namespace `PizzaReadyTycoon`:

| Script | Purpose & Responsibility |
| :--- | :--- |
| **`RestaurantConfigSO.cs`** | ScriptableObject holding player speeds, capacity, recipe prices, and prestige multipliers. |
| **`GameManager.cs`** | Singleton game controller handling money, rush hours, and subsystem dispatching. |
| **`PlayerController.cs`** | CharacterController-based player with mobile joystick and dynamic stacking physics. |
| **`WorkerAI.cs`** | NavMesh-powered AI helper running between ovens and front counters. |
| **`CustomerController.cs`** | Customer state machine (queue, order, dining, dirty table creation, leaving). |
| **`OvenStation.cs`** | Automated conveyor oven with box baking, stacking, and player pickup triggers. |
| **`FountainStation.cs`** | Soda fountain dispenser pouring drinks with combo multipliers. |
| **`SidesStation.cs`** | Double deep fryer and warmer station producing wings and breadsticks. |
| **`EscalatorController.cs`** | 3D moving escalator lifting players between 1st Floor and 2nd Floor Mezzanine. |
| **`DriveThruSystem.cs`** | Dual-lane drive-thru spawning sports cars and stretch VIP limousines. |
| **`ScooterDeliveryHub.cs`** | Online moped delivery hub with dispatch timers and delivery revenue payouts. |
| **`CityPrestigeManager.cs`** | Multi-city map switcher (Chicago, New York, Tokyo) and Golden Trophy Prestige Resets. |
| **`BattlePassManager.cs`** | 15-Tier Season 1 Chef Battle Pass with XP progression and reward claims. |
| **`IdleEarningsManager.cs`** | Offline idle revenue calculator with timestamp persistence in `PlayerPrefs`. |
| **`CinematicVFXManager.cs`** | 3D Confetti Particle Cannons and dynamic camera screen shake physics. |
| **`AudioManager.cs`** | Sound manager handling cash chimes, VIP fanfares, and multi-track BGMs. |

---

## 🛠️ Step-by-Step Unity Import Instructions

1. **Create New Project**:
   * Open Unity Hub ➔ Create new project with **3D (URP)** template.
2. **Copy Scripts**:
   * Copy the folder `unity_package/Scripts/` into your project's `Assets/Scripts/`.
3. **Tags & Layers Setup**:
   * Create Tags: `Player`, `Customer`, `Oven`, `Counter`, `Table`.
4. **NavMesh Baking**:
   * Open **Window ➔ AI ➔ Navigation** ➔ Select Floor Plane ➔ Click **Bake**.
5. **Prefabs Setup**:
   * Create prefabs for `PizzaBox`, `DrinkCup`, `ChickenWingsBucket`, `CustomerModel`, `WorkerModel`.
6. **Mobile Joystick**:
   * Import standard Joystick Pack from Unity Asset Store or use Canvas UI joystick.
