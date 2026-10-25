const fs = require('node:fs/promises');
const path = require('node:path');

class JsonFileModel {
  constructor(fileName) {
    this.filePath = path.join(__dirname, '..', 'data', fileName);
  }

  async findAll() {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const data = JSON.parse(content);
      if (!Array.isArray(data)) throw new Error(`El archivo ${path.basename(this.filePath)} debe contener una lista.`);
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.saveAll([]);
        return [];
      }
      throw error;
    }
  }

  async saveAll(records) {
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, this.filePath);
    return records;
  }
}

module.exports = JsonFileModel;
