const { copyFileSync, mkdirSync, existsSync } = require("fs");
const { resolve, dirname } = require("path");

const dataSource = resolve(__dirname, "../dist/dashboard/data.json");
const dataTarget = resolve(__dirname, "../dashboard-app/public/data.json");

if (!existsSync(dataSource)) {
  console.error(
    "Файл с данными не найден. Запустите 'npm run dashboard' для генерации dist/dashboard/data.json."
  );
  process.exit(1);
}

mkdirSync(dirname(dataTarget), { recursive: true });
copyFileSync(dataSource, dataTarget);
console.log(`Данные дашборда обновлены: ${dataSource} → ${dataTarget}`);

const liveSource = resolve(__dirname, "../dist/dashboard/live.json");
const liveTarget = resolve(__dirname, "../dashboard-app/public/live.json");

if (existsSync(liveSource)) {
  copyFileSync(liveSource, liveTarget);
  console.log(`Live-дэшборд обновлён: ${liveSource} → ${liveTarget}`);
} else {
  console.warn("Live-дэшборд отсутствует. Он появится после первого интерактивного сохранения.");
}
