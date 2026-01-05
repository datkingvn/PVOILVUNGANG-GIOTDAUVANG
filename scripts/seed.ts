import * as fs from "fs";
import * as path from "path";

// Manually load .env file FIRST (before importing anything that needs env vars)
// Try .env.local first, then .env
const envPaths = [
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), ".env"),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) return;
      const [key, ...valueParts] = trimmedLine.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        if (value) {
          process.env[key.trim()] = value.replace(/^["']|["']$/g, "");
        }
      }
    });
    console.log(`✅ Loaded environment variables from ${path.basename(envPath)}`);
    break; // Stop after loading first found file
  }
}

// Verify MONGODB_URI is loaded
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in environment variables");
  console.error("Please ensure .env or .env.local file exists with MONGODB_URI");
  process.exit(1);
}

async function seed() {
  // Use dynamic imports AFTER loading env vars
  const { default: connectDB } = await import("../lib/db/connection");
  const { default: User } = await import("../lib/db/models/User");
  const { default: Package } = await import("../lib/db/models/Package");
  const { default: Question } = await import("../lib/db/models/Question");
  const bcrypt = await import("bcryptjs");
  
  try {
    await connectDB();

    // Create MC user
    const username = process.env.MC_DEFAULT_USERNAME || "admin";
    const password = process.env.MC_DEFAULT_PASSWORD || "admin123";

    const existingUser = await User.findOne({ username });
    if (!existingUser) {
      const passwordHash = await bcrypt.hash(password, 10);
      await User.create({
        username,
        passwordHash,
        role: "MC",
      });
      console.log(`✅ Created MC user: ${username}`);
    } else {
      console.log(`ℹ️  MC user already exists: ${username}`);
    }

    // Create 4 packages for ROUND1
    for (let i = 1; i <= 4; i++) {
      const existingPackage = await Package.findOne({
        round: "ROUND1",
        number: i,
      });
      if (!existingPackage) {
        const pkg = await Package.create({
          number: i,
          round: "ROUND1",
          status: "unassigned",
          currentQuestionIndex: 0,
          questions: [],
          history: [],
        });

        // Create 12 questions for each package
        for (let j = 1; j <= 12; j++) {
          await Question.create({
            text: `Câu hỏi ${j} của Gói ${i} - Vòng 1`,
            packageId: pkg._id,
            index: j,
            round: "ROUND1",
          });
        }

        console.log(`✅ Created Package ${i} with 12 questions`);
      } else {
        console.log(`ℹ️  Package ${i} already exists`);
      }
    }

    console.log("✅ Seed completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();

