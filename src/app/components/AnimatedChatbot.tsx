import { motion } from "motion/react";
import robotImage from "figma:asset/d25a14d28ead91d81c6a1bb7fad7cacc603a2fc1.png";

export function AnimatedChatbot() {
  return (
    <div className="relative flex items-center justify-center h-[600px]">
      {/* Shadow */}
      <motion.div
        className="absolute bottom-8 w-40 h-8 bg-gray-400/30 rounded-full"
        style={{ filter: "blur(8px)" }}
        animate={{
          scaleX: [1, 0.8, 1],
          opacity: [0.3, 0.2, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Robot */}
      <motion.div
        className="relative"
        animate={{
          y: [0, -20, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <motion.img
          src={robotImage}
          alt="Chatbot"
          className="w-[500px] h-[500px]"
          style={{
            objectFit: "contain",
            imageRendering: "high-quality",
            WebkitFontSmoothing: "antialiased",
            backfaceVisibility: "hidden",
          }}
          animate={{
            rotate: [-10, 10, -10],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Greeting particles */}
        <motion.div
          className="absolute -top-2 -right-1"
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1,
          }}
        >
          <div className="w-3 h-3 bg-blue-400 rounded-full" />
        </motion.div>

        <motion.div
          className="absolute -top-1 -left-2"
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1,
            delay: 0.3,
          }}
        >
          <div className="w-2 h-2 bg-blue-300 rounded-full" />
        </motion.div>
      </motion.div>

      {/* Orbital dots */}
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="absolute w-2 h-2 bg-blue-400 rounded-full"
          animate={{
            x: [
              Math.cos((index * 2 * Math.PI) / 3) * 80,
              Math.cos(
                (index * 2 * Math.PI) / 3 + Math.PI * 2,
              ) * 80,
            ],
            y: [
              Math.sin((index * 2 * Math.PI) / 3) * 50,
              Math.sin(
                (index * 2 * Math.PI) / 3 + Math.PI * 2,
              ) * 50,
            ],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "linear",
            delay: index * 0.5,
          }}
        />
      ))}
    </div>
  );
}