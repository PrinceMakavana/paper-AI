import tap from 'tap';
import supertest from 'supertest';
import app from '../app.js';
import User from '../models/userModel.js';
import { signEmailVerificationToken } from '../utils/authTokens.js';
const server = supertest(app);

// ─── Shared test state ────────────────────────────────────────────────────────
let authToken = '';
let createdTaskId = '';
let subTaskId = '';       // dedicated task for comment/attachment tests
let createdTeamId = '';
let createdProjectId = '';
let createdCommentId = '';
let createdAttachmentId = '';

const testUser = {
    name: 'Test User',
    email: `testuser_${Date.now()}@example.com`,
    password: 'TestPass123',
};

// ─── Auth Setup ───────────────────────────────────────────────────────────────

tap.test('POST /users/register — setup test user', async (t) => {
    const response = await server.post('/users/register').send(testUser);
    t.equal(response.status, 201, 'should register successfully');
    t.notOk(response.body.token, 'should not return a token before email verification');

    const user = await User.findOne({ email: testUser.email });
    const verifyToken = signEmailVerificationToken(user._id);
    const verifyResponse = await server.post('/verify-email').send({ token: verifyToken });
    t.equal(verifyResponse.status, 200, 'should verify email for test user');

    const loginResponse = await server.post('/users/login').send({
        email: testUser.email,
        password: testUser.password,
    });
    t.equal(loginResponse.status, 200, 'should login after verification');
    t.ok(loginResponse.body.token, 'should return a token after verification');
    authToken = loginResponse.body.token;
    t.end();
});

// ─── Task CRUD Tests ──────────────────────────────────────────────────────────

tap.test('POST /tasks', async (t) => {
    const newTask = {
        title: 'New Task',
        description: 'New Task Description',
        priority: 'high',
        dueDate: '2025-12-31',
    };
    const response = await server
        .post('/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newTask);

    t.equal(response.status, 201, 'should create task');
    t.ok(response.body.task._id, 'should return task with _id');
    t.equal(response.body.task.title, 'New Task');
    t.equal(response.body.task.priority, 'high');
    createdTaskId = response.body.task._id;
    t.end();
});

tap.test('POST /tasks — without token', async (t) => {
    const response = await server.post('/tasks').send({ title: 'No Auth Task' });
    t.equal(response.status, 401, 'should reject unauthenticated request');
    t.end();
});

tap.test('POST /tasks — missing title', async (t) => {
    const response = await server
        .post('/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'No title provided' });
    t.equal(response.status, 400, 'should reject task without title');
    t.end();
});

tap.test('GET /tasks', async (t) => {
    const response = await server
        .get('/tasks')
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200, 'should return tasks');
    t.ok(Array.isArray(response.body.tasks), 'body.tasks should be an array');
    t.type(response.body.count, 'number', 'body.count should be a number');
    const task = response.body.tasks[0];
    t.ok(task._id, 'task should have _id');
    t.ok(task.title, 'task should have title');
    t.type(task.completed, 'boolean', 'task.completed should be boolean');
    t.end();
});

tap.test('GET /tasks — filter by priority', async (t) => {
    const response = await server
        .get('/tasks?priority=high')
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200);
    const allHigh = response.body.tasks.every((t) => t.priority === 'high');
    t.ok(allHigh, 'all returned tasks should have priority=high');
    t.end();
});

tap.test('GET /tasks — filter by completed', async (t) => {
    const response = await server
        .get('/tasks?completed=false')
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200);
    const allIncomplete = response.body.tasks.every((t) => t.completed === false);
    t.ok(allIncomplete, 'all returned tasks should be incomplete');
    t.end();
});

tap.test('GET /tasks — search', async (t) => {
    const response = await server
        .get('/tasks?search=New Task')
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200);
    t.ok(response.body.tasks.length >= 1, 'should find at least 1 matching task');
    t.end();
});

tap.test('GET /tasks — sort by dueDate asc', async (t) => {
    const response = await server
        .get('/tasks?sortBy=dueDate&order=asc')
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200);
    t.end();
});

tap.test('GET /tasks/:id', async (t) => {
    const response = await server
        .get(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200, 'should return the task');
    t.equal(response.body.task._id, createdTaskId, 'should return the correct task');
    t.end();
});

tap.test('GET /tasks/:id — invalid id', async (t) => {
    const response = await server
        .get('/tasks/000000000000000000000000')
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 404, 'should return 404 for unknown task id');
    t.end();
});

tap.test('PUT /tasks/:id', async (t) => {
    const updatedTask = {
        title: 'Updated Task',
        description: 'Updated description',
        completed: true,
        priority: 'low',
        tags: ['updated', 'test'],
    };
    const response = await server
        .put(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedTask);

    t.equal(response.status, 200, 'should update task');
    t.equal(response.body.task.title, 'Updated Task');
    t.equal(response.body.task.completed, true);
    t.same(response.body.task.tags, ['updated', 'test']);
    t.end();
});

tap.test('PUT /tasks/:id — invalid id', async (t) => {
    const response = await server
        .put('/tasks/000000000000000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Ghost Update' });

    t.equal(response.status, 404, 'should return 404 for unknown task id');
    t.end();
});

// ─── Comments Tests ───────────────────────────────────────────────────────────

// Create a dedicated task for comment/attachment tests (won't be deleted early)
tap.test('POST /tasks — create sub-task for comment/attachment tests', async (t) => {
    const response = await server
        .post('/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Sub Task for Comments', priority: 'low' });

    t.equal(response.status, 201, 'should create sub-task');
    subTaskId = response.body.task._id;
    t.end();
});

tap.test('POST /tasks/:id/comments — add comment', async (t) => {
    const response = await server
        .post(`/tasks/${subTaskId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'This is a test comment.' });

    t.equal(response.status, 201, 'should add comment');
    t.ok(response.body.comment._id, 'comment should have _id');
    t.equal(response.body.comment.text, 'This is a test comment.');
    createdCommentId = response.body.comment._id;
    t.end();
});

tap.test('POST /tasks/:id/comments — missing text', async (t) => {
    const response = await server
        .post(`/tasks/${subTaskId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

    t.equal(response.status, 400, 'should reject comment without text');
    t.end();
});

tap.test('GET /tasks/:id — task includes comments', async (t) => {
    const response = await server
        .get(`/tasks/${subTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200);
    t.ok(Array.isArray(response.body.task.comments), 'task should have comments array');
    t.ok(response.body.task.comments.length >= 1, 'should have at least 1 comment');
    t.end();
});

tap.test('DELETE /tasks/:id/comments/:commentId', async (t) => {
    const response = await server
        .delete(`/tasks/${subTaskId}/comments/${createdCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200, 'should delete comment');
    t.end();
});

// ─── Attachments Tests ────────────────────────────────────────────────────────

tap.test('POST /tasks/:id/attachments — add attachment', async (t) => {
    const response = await server
        .post(`/tasks/${subTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ filename: 'design.pdf', url: 'https://example.com/design.pdf' });

    t.equal(response.status, 201, 'should add attachment');
    t.ok(response.body.attachment._id, 'attachment should have _id');
    t.equal(response.body.attachment.filename, 'design.pdf');
    createdAttachmentId = response.body.attachment._id;
    t.end();
});

tap.test('POST /tasks/:id/attachments — missing fields', async (t) => {
    const response = await server
        .post(`/tasks/${subTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ filename: 'only-name.pdf' });

    t.equal(response.status, 400, 'should reject attachment without url');
    t.end();
});

tap.test('GET /tasks/:id — task includes attachments', async (t) => {
    const response = await server
        .get(`/tasks/${subTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200);
    t.ok(Array.isArray(response.body.task.attachments), 'task should have attachments array');
    t.ok(response.body.task.attachments.length >= 1, 'should have at least 1 attachment');
    t.end();
});

tap.test('DELETE /tasks/:id/attachments/:attachmentId', async (t) => {
    const response = await server
        .delete(`/tasks/${subTaskId}/attachments/${createdAttachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200, 'should delete attachment');
    t.end();
});


// ─── Team Tests ───────────────────────────────────────────────────────────────


tap.test('POST /teams — create team', async (t) => {
    const response = await server
        .post('/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Alpha Team', description: 'Our first team' });

    t.equal(response.status, 201, 'should create team');
    t.ok(response.body.team._id, 'team should have _id');
    t.equal(response.body.team.name, 'Alpha Team');
    t.equal(response.body.team.members.length, 1, 'creator should be first member');
    t.equal(response.body.team.members[0].role, 'owner', 'creator role should be owner');
    createdTeamId = response.body.team._id;
    t.end();
});

tap.test('POST /teams — missing name', async (t) => {
    const response = await server
        .post('/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'No name' });

    t.equal(response.status, 400, 'should reject team without name');
    t.end();
});

tap.test('GET /teams — list my teams', async (t) => {
    const response = await server
        .get('/teams')
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200);
    t.ok(Array.isArray(response.body.teams), 'should return teams array');
    t.ok(response.body.teams.length >= 1, 'should have at least 1 team');
    t.end();
});

tap.test('GET /teams/:id', async (t) => {
    const response = await server
        .get(`/teams/${createdTeamId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200, 'should return team');
    t.equal(response.body.team._id, createdTeamId);
    t.end();
});

tap.test('PUT /teams/:id — update team', async (t) => {
    const response = await server
        .put(`/teams/${createdTeamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Alpha Team Updated', description: 'Updated description' });

    t.equal(response.status, 200, 'should update team');
    t.equal(response.body.team.name, 'Alpha Team Updated');
    t.end();
});

tap.test('POST /teams/:id/join — cannot join own team', async (t) => {
    const response = await server
        .post(`/teams/${createdTeamId}/join`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 409, 'should reject duplicate join');
    t.end();
});

tap.test('POST /teams/:id/leave — owner cannot leave', async (t) => {
    const response = await server
        .post(`/teams/${createdTeamId}/leave`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 400, 'owner should not be able to leave');
    t.end();
});

// ─── Project Tests ────────────────────────────────────────────────────────────

tap.test('POST /teams/:teamId/projects — create project', async (t) => {
    const response = await server
        .post(`/teams/${createdTeamId}/projects`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Website Redesign', description: 'Redesign the company website' });

    t.equal(response.status, 201, 'should create project');
    t.ok(response.body.project._id, 'project should have _id');
    t.equal(response.body.project.name, 'Website Redesign');
    t.equal(response.body.project.team, createdTeamId, 'project should be linked to team');
    createdProjectId = response.body.project._id;
    t.end();
});

tap.test('POST /teams/:teamId/projects — missing name', async (t) => {
    const response = await server
        .post(`/teams/${createdTeamId}/projects`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'No name' });

    t.equal(response.status, 400, 'should reject project without name');
    t.end();
});

tap.test('GET /teams/:teamId/projects — list projects', async (t) => {
    const response = await server
        .get(`/teams/${createdTeamId}/projects`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200);
    t.ok(Array.isArray(response.body.projects), 'should return projects array');
    t.ok(response.body.projects.length >= 1, 'should have at least 1 project');
    t.end();
});

tap.test('GET /projects/:id', async (t) => {
    const response = await server
        .get(`/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200, 'should return project');
    t.equal(response.body.project._id, createdProjectId);
    t.end();
});

tap.test('PUT /projects/:id — update project', async (t) => {
    const response = await server
        .put(`/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Website Redesign v2' });

    t.equal(response.status, 200, 'should update project');
    t.equal(response.body.project.name, 'Website Redesign v2');
    t.end();
});

// ─── Task with project + assignedTo ──────────────────────────────────────────

tap.test('POST /tasks — with project linkage', async (t) => {
    const response = await server
        .post('/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
            title: 'Project Task',
            description: 'A task linked to a project',
            priority: 'high',
            project: createdProjectId,
        });

    t.equal(response.status, 201, 'should create task linked to project');
    t.ok(response.body.task.project, 'task should have project field');
    t.end();
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

tap.test('DELETE /tasks/:id', async (t) => {
    const response = await server
        .delete(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200, 'should delete task');
    t.end();
});

tap.test('DELETE /tasks/:id — already deleted', async (t) => {
    const response = await server
        .delete(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 404, 'should return 404 for already deleted task');
    t.end();
});

tap.test('DELETE /projects/:id', async (t) => {
    const response = await server
        .delete(`/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

    t.equal(response.status, 200, 'should delete project');
    t.end();
});

tap.teardown(() => {
    process.exit(0);
});
