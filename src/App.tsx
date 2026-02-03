import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Bumper {
  x: number;
  y: number;
  radius: number;
  points: number;
  hit: boolean;
  color: string;
}

interface Flipper {
  x: number;
  y: number;
  length: number;
  angle: number;
  targetAngle: number;
  side: 'left' | 'right';
}

const GRAVITY = 0.15;
const FRICTION = 0.995;
const BALL_RADIUS = 10;
const FLIPPER_SPEED = 0.35;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('pinball-highscore');
    return saved ? parseInt(saved) : 0;
  });
  const [ballsLeft, setBallsLeft] = useState(3);
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'launching' | 'gameover'>('ready');
  const [launchPower, setLaunchPower] = useState(0);

  const ballRef = useRef<Ball>({ x: 380, y: 700, vx: 0, vy: 0, radius: BALL_RADIUS });
  const flippersRef = useRef<Flipper[]>([
    { x: 120, y: 680, length: 70, angle: 0.4, targetAngle: 0.4, side: 'left' },
    { x: 280, y: 680, length: 70, angle: Math.PI - 0.4, targetAngle: Math.PI - 0.4, side: 'right' }
  ]);
  const bumpersRef = useRef<Bumper[]>([
    { x: 200, y: 200, radius: 30, points: 100, hit: false, color: '#ff00ff' },
    { x: 120, y: 300, radius: 25, points: 75, hit: false, color: '#00ffff' },
    { x: 280, y: 300, radius: 25, points: 75, hit: false, color: '#00ffff' },
    { x: 200, y: 400, radius: 20, points: 50, hit: false, color: '#ffff00' },
    { x: 100, y: 450, radius: 20, points: 50, hit: false, color: '#ff00aa' },
    { x: 300, y: 450, radius: 20, points: 50, hit: false, color: '#ff00aa' },
  ]);
  const keysRef = useRef<Set<string>>(new Set());
  const particlesRef = useRef<Array<{x: number; y: number; vx: number; vy: number; life: number; color: string}>>([]);
  const trailRef = useRef<Array<{x: number; y: number; alpha: number}>>([]);

  const resetBall = useCallback(() => {
    ballRef.current = { x: 380, y: 650, vx: 0, vy: 0, radius: BALL_RADIUS };
    setGameState('launching');
    setLaunchPower(0);
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setBallsLeft(3);
    resetBall();
  }, [resetBall]);

  const addParticles = useCallback((x: number, y: number, color: string, count: number = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color
      });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === ' ' && gameState === 'ready') {
        startGame();
      }
      if (e.key === ' ' && gameState === 'gameover') {
        startGame();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
      if (e.key === ' ' && gameState === 'launching' && launchPower > 0) {
        ballRef.current.vy = -launchPower * 0.3;
        ballRef.current.vx = -2;
        setGameState('playing');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, launchPower, startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      const ball = ballRef.current;
      const flippers = flippersRef.current;
      const bumpers = bumpersRef.current;

      // Update launch power
      if (gameState === 'launching' && keysRef.current.has(' ')) {
        setLaunchPower(p => Math.min(p + 2, 100));
      }

      // Update flippers
      flippers.forEach(flipper => {
        if (flipper.side === 'left') {
          flipper.targetAngle = keysRef.current.has('z') || keysRef.current.has('arrowleft') ? -0.5 : 0.4;
        } else {
          flipper.targetAngle = keysRef.current.has('/') || keysRef.current.has('arrowright') ? Math.PI + 0.5 : Math.PI - 0.4;
        }
        const diff = flipper.targetAngle - flipper.angle;
        flipper.angle += diff * FLIPPER_SPEED;
      });

      if (gameState === 'playing') {
        // Physics
        ball.vy += GRAVITY;
        ball.vx *= FRICTION;
        ball.vy *= FRICTION;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Trail
        trailRef.current.push({ x: ball.x, y: ball.y, alpha: 1 });
        if (trailRef.current.length > 20) trailRef.current.shift();
        trailRef.current.forEach(t => t.alpha *= 0.9);

        // Wall collisions
        if (ball.x - ball.radius < 20) {
          ball.x = 20 + ball.radius;
          ball.vx = Math.abs(ball.vx) * 0.8;
        }
        if (ball.x + ball.radius > 380) {
          ball.x = 380 - ball.radius;
          ball.vx = -Math.abs(ball.vx) * 0.8;
        }
        if (ball.y - ball.radius < 20) {
          ball.y = 20 + ball.radius;
          ball.vy = Math.abs(ball.vy) * 0.8;
        }

        // Bumper collisions
        bumpers.forEach(bumper => {
          const dx = ball.x - bumper.x;
          const dy = ball.y - bumper.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < ball.radius + bumper.radius) {
            const angle = Math.atan2(dy, dx);
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx = Math.cos(angle) * Math.max(speed * 1.2, 8);
            ball.vy = Math.sin(angle) * Math.max(speed * 1.2, 8);
            ball.x = bumper.x + Math.cos(angle) * (ball.radius + bumper.radius + 1);
            ball.y = bumper.y + Math.sin(angle) * (ball.radius + bumper.radius + 1);
            bumper.hit = true;
            setTimeout(() => bumper.hit = false, 100);
            setScore(s => s + bumper.points);
            addParticles(bumper.x, bumper.y, bumper.color, 15);
          }
        });

        // Flipper collisions
        flippers.forEach(flipper => {
          const flipperEndX = flipper.x + Math.cos(flipper.angle) * flipper.length;
          const flipperEndY = flipper.y + Math.sin(flipper.angle) * flipper.length;

          const dx = flipperEndX - flipper.x;
          const dy = flipperEndY - flipper.y;
          const t = Math.max(0, Math.min(1, ((ball.x - flipper.x) * dx + (ball.y - flipper.y) * dy) / (dx * dx + dy * dy)));
          const closestX = flipper.x + t * dx;
          const closestY = flipper.y + t * dy;

          const distX = ball.x - closestX;
          const distY = ball.y - closestY;
          const dist = Math.sqrt(distX * distX + distY * distY);

          if (dist < ball.radius + 8) {
            const normalAngle = Math.atan2(distY, distX);
            const flipperMoving = Math.abs(flipper.targetAngle - flipper.angle) > 0.1;
            const boost = flipperMoving ? 15 : 5;
            ball.vx = Math.cos(normalAngle) * boost;
            ball.vy = Math.sin(normalAngle) * boost - 3;
            ball.x = closestX + Math.cos(normalAngle) * (ball.radius + 10);
            ball.y = closestY + Math.sin(normalAngle) * (ball.radius + 10);
            addParticles(ball.x, ball.y, '#00ffff', 5);
          }
        });

        // Angled walls (gutters)
        const checkAngledWall = (x1: number, y1: number, x2: number, y2: number) => {
          const dx = x2 - x1;
          const dy = y2 - y1;
          const t = Math.max(0, Math.min(1, ((ball.x - x1) * dx + (ball.y - y1) * dy) / (dx * dx + dy * dy)));
          const closestX = x1 + t * dx;
          const closestY = y1 + t * dy;
          const distX = ball.x - closestX;
          const distY = ball.y - closestY;
          const dist = Math.sqrt(distX * distX + distY * distY);

          if (dist < ball.radius + 3) {
            const normalAngle = Math.atan2(distY, distX);
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx = Math.cos(normalAngle) * speed * 0.7;
            ball.vy = Math.sin(normalAngle) * speed * 0.7;
            ball.x = closestX + Math.cos(normalAngle) * (ball.radius + 5);
            ball.y = closestY + Math.sin(normalAngle) * (ball.radius + 5);
          }
        };

        checkAngledWall(20, 550, 100, 650);
        checkAngledWall(380, 550, 300, 650);

        // Ball lost
        if (ball.y > 780) {
          setBallsLeft(prev => {
            const newBalls = prev - 1;
            if (newBalls <= 0) {
              setGameState('gameover');
              setHighScore(hs => {
                const newHigh = Math.max(hs, score);
                localStorage.setItem('pinball-highscore', newHigh.toString());
                return newHigh;
              });
            } else {
              resetBall();
            }
            return newBalls;
          });
        }
      }

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        return p.life > 0;
      });

      // === RENDERING ===
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, 400, 800);

      // Scanlines effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      for (let i = 0; i < 800; i += 4) {
        ctx.fillRect(0, i, 400, 2);
      }

      // Playfield background glow
      const gradient = ctx.createRadialGradient(200, 400, 0, 200, 400, 400);
      gradient.addColorStop(0, 'rgba(100, 0, 150, 0.15)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 400, 800);

      // Draw walls with neon effect
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(20, 20);
      ctx.lineTo(20, 550);
      ctx.lineTo(100, 650);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(380, 20);
      ctx.lineTo(380, 550);
      ctx.lineTo(300, 650);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(20, 20);
      ctx.lineTo(380, 20);
      ctx.stroke();

      // Launch tube
      ctx.strokeStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.beginPath();
      ctx.moveTo(380, 550);
      ctx.lineTo(380, 780);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Draw bumpers
      bumpers.forEach(bumper => {
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);

        const bumperGradient = ctx.createRadialGradient(
          bumper.x - bumper.radius * 0.3, bumper.y - bumper.radius * 0.3, 0,
          bumper.x, bumper.y, bumper.radius
        );
        bumperGradient.addColorStop(0, bumper.hit ? '#ffffff' : bumper.color);
        bumperGradient.addColorStop(1, bumper.hit ? bumper.color : '#000000');
        ctx.fillStyle = bumperGradient;
        ctx.fill();

        ctx.strokeStyle = bumper.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = bumper.color;
        ctx.shadowBlur = bumper.hit ? 30 : 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Points label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bumper.points.toString(), bumper.x, bumper.y + 4);
      });

      // Draw flippers
      flippers.forEach(flipper => {
        ctx.save();
        ctx.translate(flipper.x, flipper.y);
        ctx.rotate(flipper.angle);

        const flipperGradient = ctx.createLinearGradient(0, -10, 0, 10);
        flipperGradient.addColorStop(0, '#ff6600');
        flipperGradient.addColorStop(0.5, '#ffaa00');
        flipperGradient.addColorStop(1, '#ff6600');

        ctx.fillStyle = flipperGradient;
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(flipper.length, -4);
        ctx.lineTo(flipper.length, 4);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      });

      // Draw ball trail
      trailRef.current.forEach((t, i) => {
        if (t.alpha > 0.1) {
          ctx.beginPath();
          ctx.arc(t.x, t.y, ball.radius * (i / trailRef.current.length), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 100, 255, ${t.alpha * 0.5})`;
          ctx.fill();
        }
      });

      // Draw particles
      particlesRef.current.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw ball
      if (gameState === 'playing' || gameState === 'launching') {
        const ballGradient = ctx.createRadialGradient(
          ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, 0,
          ball.x, ball.y, ball.radius
        );
        ballGradient.addColorStop(0, '#ffffff');
        ballGradient.addColorStop(0.3, '#dddddd');
        ballGradient.addColorStop(1, '#888888');

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ballGradient;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Launch power meter
      if (gameState === 'launching') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(385, 600, 12, 150);

        const powerGradient = ctx.createLinearGradient(385, 750, 385, 600);
        powerGradient.addColorStop(0, '#00ff00');
        powerGradient.addColorStop(0.5, '#ffff00');
        powerGradient.addColorStop(1, '#ff0000');

        ctx.fillStyle = powerGradient;
        ctx.fillRect(387, 748 - launchPower * 1.46, 8, launchPower * 1.46);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(385, 600, 12, 150);
      }

      // UI Overlay
      ctx.fillStyle = '#ff00ff';
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 10;
      ctx.font = '24px "Press Start 2P", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${score.toString().padStart(7, '0')}`, 20, 810);

      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`HI ${highScore.toString().padStart(7, '0')}`, 380, 810);

      // Balls left
      ctx.fillStyle = '#ffff00';
      ctx.shadowColor = '#ffff00';
      for (let i = 0; i < ballsLeft; i++) {
        ctx.beginPath();
        ctx.arc(30 + i * 25, 780, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Game state overlays
      if (gameState === 'ready') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, 400, 800);

        ctx.fillStyle = '#ff00ff';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 30;
        ctx.font = '32px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PINBALL', 200, 300);

        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillText('PRESS SPACE', 200, 400);
        ctx.fillText('TO START', 200, 420);

        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillText('Z / LEFT = LEFT FLIPPER', 200, 500);
        ctx.fillText('/ / RIGHT = RIGHT FLIPPER', 200, 520);
        ctx.fillText('SPACE = LAUNCH BALL', 200, 540);
        ctx.shadowBlur = 0;
      }

      if (gameState === 'launching') {
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HOLD SPACE TO CHARGE', 200, 50);
        ctx.fillText('RELEASE TO LAUNCH', 200, 70);
        ctx.shadowBlur = 0;
      }

      if (gameState === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, 400, 800);

        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 30;
        ctx.font = '24px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', 200, 300);

        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillText(`SCORE: ${score}`, 200, 380);

        if (score >= highScore) {
          ctx.fillStyle = '#00ff00';
          ctx.shadowColor = '#00ff00';
          ctx.fillText('NEW HIGH SCORE!', 200, 420);
        }

        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillText('PRESS SPACE', 200, 500);
        ctx.fillText('TO PLAY AGAIN', 200, 520);
        ctx.shadowBlur = 0;
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => cancelAnimationFrame(animationId);
  }, [gameState, launchPower, score, highScore, addParticles, resetBall]);

  return (
    <div className="app-container">
      <div className="arcade-cabinet">
        <div className="cabinet-header">
          <h1 className="title">NEON PINBALL</h1>
          <div className="title-underline"></div>
        </div>
        <div className="screen-bezel">
          <div className="screen-inner">
            <canvas
              ref={canvasRef}
              width={400}
              height={830}
              className="game-canvas"
            />
          </div>
        </div>
        <div className="controls-info">
          <div className="control-key">
            <span className="key">Z</span>
            <span className="key-label">LEFT</span>
          </div>
          <div className="control-key">
            <span className="key">SPACE</span>
            <span className="key-label">LAUNCH</span>
          </div>
          <div className="control-key">
            <span className="key">/</span>
            <span className="key-label">RIGHT</span>
          </div>
        </div>
      </div>
      <footer className="footer">
        Requested by @GoldenFarFR · Built by @clonkbot
      </footer>
    </div>
  );
}