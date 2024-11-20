# ARVR1
# PhysioFit

**PhysioFit** is an innovative application designed to assist physiotherapists in delivering care to patients remotely. It leverages advanced technologies to enable patients to perform exercises at home while maintaining precise posture and alignment under virtual supervision.

## Uses of PhysioFit
- Allows physiotherapists to monitor and guide patients who cannot attend in-person sessions.
- Provides real-time feedback on posture and movement accuracy, enhancing rehabilitation effectiveness.
- Gamifies physiotherapy with a health bar system, making exercises more engaging for patients.
- Offers an accessible and scalable solution for remote physiotherapy care.

## How It Works
The backend of PhysioFit processes 3D coordinates from the patient’s movements (captured via tools like MediaPipe) and compares them to the reference model's coordinates. A matching algorithm evaluates the similarity, updating the health bar dynamically. Once the health bar turns green, the patient can proceed to the next exercise selected from a dropdown list.

# How to run this project file?
- `cd` into your folder of choice
- run `git clone https://github.com/channabasappa164/ARVR1.git` in that folder.
- Install dependencies for the project by running `npm i` on your bash terminal
- Open the split terminal and do the following:
- `cd client` and `npm start` to start frontend
- In another terminal `cd server` and `node server.js` to start the backend

### You must have a camera attached to your device or else this application will not work
---

**Developed as an initiative for the AR/VR elective 2024.**
