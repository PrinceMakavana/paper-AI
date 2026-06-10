const fs = require('fs/promises');
const path = require('path');
const os = require('os');

function getJobTempRoot() {
    return process.env.PAGEINDEX_JOB_TEMP_ROOT || path.join(os.tmpdir(), 'pageindex-jobs');
}

async function stageJobFile(jobId, fileBuffer) {
    const dir = path.join(getJobTempRoot(), String(jobId));
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'source.pdf');
    await fs.writeFile(filePath, fileBuffer);
    return filePath;
}

async function deleteStagedJobFile(filePath) {
    if (!filePath) return;
    try {
        await fs.unlink(filePath);
        await fs.rmdir(path.dirname(filePath)).catch(() => {});
    } catch {
        // ignore missing files
    }
}

module.exports = {
    getJobTempRoot,
    stageJobFile,
    deleteStagedJobFile,
};
