from fastapi import Body, FastAPI, Form, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from worker import create_task, build_runestone_book, clone_runestone_book
from celery.result import AsyncResult
from sqlalchemy import create_engine
import os
from sqlalchemy import create_engine, Table, MetaData, select, and_, or_
from sqlalchemy.orm.session import sessionmaker


app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("home.html", context={"request": request})


@app.post("/book_in_db")
def check_db(payload=Body(...)):
    base_course = payload["bcname"]
    # connect to db and check if book is there and if base_course == course_name
    if "DEV_DBURL" not in os.environ:
        return JSONResponse({"detail": "DBURL is not set"})
    else:
        engine = create_engine(os.environ["DEV_DBURL"])
        Session = sessionmaker()
        engine.connect()
        Session.configure(bind=engine)
        sess = Session()
        # If no exceptions are raised, then set up the database.
        meta = MetaData()
        courses = Table("courses", meta, autoload=True, autoload_with=engine)
        sel = select([courses]).where(courses.c.course_name == base_course)
        res = sess.execute(sel).first()
        detail = res.get("id", False) if res else False
        return JSONResponse({"detail": detail})


@app.post("/add_course")
def new_course(payload=Body(...)):
    base_course = payload["bcname"]
    if "DEV_DBURL" not in os.environ:
        return JSONResponse({"detail": "DBURL is not set"})
    else:
        engine = create_engine(os.environ["DEV_DBURL"])
        res = engine.execute(
            f"""insert into courses
           (course_name, base_course, python3, term_start_date, login_required, institution, courselevel, downloads_enabled, allow_pairs, new_server)
                values ('{base_course}',
                '{base_course}',
                'T',
                '2022-01-01',
                'F',
                'Runestone',
                '',
                'F',
                'F',
                'T')
                """
        )

        if res:
            return JSONResponse({"detail": "success"})
        else:
            return JSONResponse({"detail": "fail"})


@app.post("/clone", status_code=201)
def do_clone(payload=Body(...)):
    repourl = payload["url"]
    bcname = payload["bcname"]
    task = clone_runestone_book.delay(repourl, bcname)
    return JSONResponse({"task_id": task.id})


@app.post("/tasks", status_code=201)
def run_task(payload=Body(...)):
    task_type = payload["type"]
    task = create_task.delay(int(task_type))
    return JSONResponse({"task_id": task.id})


@app.get("/tasks/{task_id}")
def get_status(task_id):
    task_result = AsyncResult(task_id)
    result = {
        "task_id": task_id,
        "task_status": task_result.status,
        "task_result": task_result.result,
    }
    return JSONResponse(result)
