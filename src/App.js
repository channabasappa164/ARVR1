import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Vector3, AnimationMixer } from 'three';
import * as mpPose from '@mediapipe/pose';
import { useFrame } from '@react-three/fiber';
import './App.css';

// Component to load and display a 3D model with animations and extract bone joint coordinates
const Model = ({ url, position, visible, setModelCoordinates }) => {
  const { scene, animations } = useGLTF(url); // Load the 3D model and animations using the GLTF loader
  const mixer = useRef(); // Reference for managing animations of the 3D model

  useEffect(() => {
    // Initialize the animation mixer and play the animations if available
    if (animations && animations.length) {
      mixer.current = new AnimationMixer(scene);
      animations.forEach((clip) => {
        mixer.current.clipAction(clip).play(); // Play all animation clips of the model
      });
    }

    // Extract and store the bone joint coordinates from the model
    const extractBoneJointCoordinates = () => {
      const coordinates = []; // Array to store coordinates
      scene.traverse((child) => {
        if (child.isBone) {
          // Identify bones in the model hierarchy
          const worldPosition = new Vector3(); // Create a vector to store the bone's position
          child.updateMatrixWorld(true); // Update the transformation matrix
          worldPosition.setFromMatrixPosition(child.matrixWorld); // Extract the world position of the bone
          coordinates.push([worldPosition.x, worldPosition.y, worldPosition.z]); // Add to coordinates array
        }
      });
      setModelCoordinates(coordinates); // Pass coordinates to the parent component
    };

    extractBoneJointCoordinates(); // Call the function to extract coordinates

    return () => {
      mixer.current = null; // Cleanup animation mixer when the component unmounts
    };
  }, [animations, scene, setModelCoordinates]);

  // Update the animation mixer on each frame for smooth animation playback
  useFrame((state, delta) => {
    const speedFactor = 0.2; // Factor to control the speed of the animation
    mixer.current?.update(delta * speedFactor); // Update mixer with delta time
  });

  // Render the 3D model with the provided position and visibility
  return <primitive object={scene} position={position} visible={visible} />;
};

// Component to create a simple flat ground plane
const Ground = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
    <planeGeometry args={[200, 200]} /> {/* Large plane geometry to simulate ground */}
    <meshStandardMaterial color="gray" /> {/* Gray material for the ground */}
  </mesh>
);

function App() {
  // State variables for managing the app's data and UI
  const [selectedModel, setSelectedModel] = useState('trial-1.glb'); // Currently selected model
  const [modelCoordinates, setModelCoordinates] = useState([]); // Coordinates extracted from the 3D model
  const [videoCoordinates, setVideoCoordinates] = useState([]); // Coordinates extracted from the video feed
  const [similarity, setSimilarity] = useState(0); // Similarity percentage between model and video coordinates
  const [loading, setLoading] = useState(true); // Loading state for the app
  const videoRef = useRef(null); // Reference to the video element for webcam feed
  const canvasRef = useRef(null); // Reference to the canvas for drawing pose landmarks

  // Effect to initialize webcam access
  useEffect(() => {
    const getWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true }); // Request webcam access
        videoRef.current.srcObject = stream; // Set webcam stream as the video source
      } catch (err) {
        console.error('Error accessing the webcam:', err); // Handle errors
      } finally {
        setLoading(false); // Set loading state to false after webcam initialization
      }
    };

    getWebcam(); // Call function to initialize webcam
  }, []);

  // Function to draw pose landmarks and connections on the canvas
  const drawLandmarksOnCanvas = (landmarks) => {
    const canvas = canvasRef.current; // Get the canvas element
    const ctx = canvas.getContext('2d'); // Get the canvas rendering context
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height); // Draw video frame onto the canvas

    // Draw each landmark as a red circle
    ctx.fillStyle = 'red';
    landmarks.forEach(({ x, y }) => {
      ctx.beginPath();
      ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI); // Scale coordinates to canvas size
      ctx.fill();
    });

    // Draw connections between landmarks using the POSE_CONNECTIONS list
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    for (let i = 0; i < mpPose.POSE_CONNECTIONS.length; i++) {
      const [start, end] = mpPose.POSE_CONNECTIONS[i];
      const startLandmark = landmarks[start];
      const endLandmark = landmarks[end];
      ctx.beginPath();
      ctx.moveTo(startLandmark.x * canvas.width, startLandmark.y * canvas.height);
      ctx.lineTo(endLandmark.x * canvas.width, endLandmark.y * canvas.height);
      ctx.stroke();
    }
  };

  // Initialize MediaPipe Pose for pose estimation
  useEffect(() => {
    const pose = new mpPose.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`, // Specify file location
    });
    pose.setOptions({
      modelComplexity: 1, // Set the complexity of the model
      smoothLandmarks: true, // Smooth pose landmarks over time
      enableSegmentation: false, // Disable segmentation
      minDetectionConfidence: 0.5, // Minimum confidence for detection
      minTrackingConfidence: 0.5, // Minimum confidence for tracking
    });

    // Handle pose results from MediaPipe
    pose.onResults((results) => {
      if (results.poseLandmarks) {
        const coordinates = results.poseLandmarks.map((landmark) => [
          landmark.x,
          landmark.y,
          landmark.z,
        ]);
        setVideoCoordinates(coordinates); // Store coordinates from video feed
        drawLandmarksOnCanvas(results.poseLandmarks); // Draw pose on the canvas
      }
    });

    // Function to send video frame to MediaPipe for pose detection
    const sendFrameToPose = async () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height); // Draw video frame on canvas
      await pose.send({ image: canvas }); // Send frame to MediaPipe
    };

    // Interval to continuously process video frames
    const intervalId = setInterval(() => {
      sendFrameToPose();
    }, 1000); // Process frame every second

    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, []);

  // Send coordinates to the server for similarity calculation
  useEffect(() => {
    const sendCoordinatesToServer = async () => {
      try {
        const response = await fetch('https://arvr1-4.onrender.com/api/coordinates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelCoordinates, videoCoordinates }), // Send coordinates
        });
        const data = await response.json();
        setSimilarity(data.similarity); // Update similarity percentage
      } catch (error) {
        console.error('Error sending coordinates:', error); // Log any errors
      }
    };

    // Interval to periodically send coordinates to the server
    const intervalId = setInterval(() => {
      sendCoordinatesToServer();
    }, 1000); // Send data every second

    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, [modelCoordinates, videoCoordinates]);

  return (
    <div className="App">
      {/* Show a loading screen while initializing */}
      {loading && (
        <div className="loading-screen">
          <div className="spinner"></div>
          <h2>Loading...</h2>
        </div>
      )}

      {/* Health bar to display the similarity percentage */}
      <div className="health-bar-container">
        <h2>Health Bar</h2>
        <div className="health-bar">
          <div
            className="health-fill"
            style={{
              width: `${similarity}%`, // Fill width based on similarity
              backgroundColor: similarity > 70 ? 'green' : similarity > 40 ? 'yellow' : 'red', // Color code
            }}
          />
        </div>
        <p>{similarity.toFixed(2)}%</p> {/* Display similarity as a percentage */}
      </div>

      {/* Main container for the MediaPipe and 3D model viewer */}
      <div className="container">
        {/* Video feed and pose detection */}
        <div className="mediaPipe">
          <video ref={videoRef} autoPlay style={{ width: '100%', height: '100%' }} /> {/* Webcam video */}
          <canvas ref={canvasRef} width={640} height={480} /> {/* Canvas for drawing pose */}
        </div>

        {/* 3D model viewer with selectable models */}
        <div className="modelViewer">
          <select onChange={(e) => setSelectedModel(e.target.value)} value={selectedModel}>
            <option value="trial-1.glb">Exercise 1</option>
            <option value="trial-2.glb">Exercise 2</option>
          </select>
          <Canvas style={{ height: '100vh' }} shadows>
            <ambientLight intensity={0.5} /> {/* Ambient light for scene */}
            <directionalLight position={[10, 10, 10]} intensity={0.7} castShadow /> {/* Directional light */}
            <Ground /> {/* Ground plane */}
            <Model
              url={`/models/${selectedModel}`} // Path to selected model
              position={[0, 0, 0]} // Position in 3D space
              visible={true} // Visibility toggle
              setModelCoordinates={setModelCoordinates} // Function to update coordinates
            />
            <OrbitControls /> {/* Allow user to orbit and zoom in the scene */}
          </Canvas>
        </div>
      </div>
    </div>
  );
}

export default App;
