const { copyFileSync, mkdirSync, existsSync } = require("fs");
const { resolve, dirname } = require("path");

const source = resolve(__dirname, "../dist/dashboard/data.json");
const target = resolve(__dirname, "../dashboard-app/public/data.json");

if (!existsSync(source)) {
  console.error(
    "Файл с данными не найден. Запустите 'npm run dashboard' для генерации dist/dashboard/data.json."
  );
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);

console.log(`Данные дашборда обновлены: ${source} → ${target}`);
