/*
 * Javascript functions for Single Page App
 * Author: Brad Miller
 * Date: 2022-07-11
 *
 */
var taskId2Task = {}

function handleClick(type) {
    fetch("/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: type }),
    })
        .then((response) => response.json())
        .then((data) => {
            getStatus(data.task_id);
        });
}

// Trigger the task to clone a given repo.
// This task is implemented in worker.py
//
function cloneTask() {
    let repo = document.querySelector("#gitrepo");
    let bcname = document.querySelector("#bcname");
    fetch("/clone", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: repo.value, bcname: bcname.value }),
    })
        .then((response) => response.json())
        .then((data) => {
            getStatus(data.task_id);
        });
}

// Schedule a task to build a book then follow its status
function buildTask(bcname) {
    fetch("/buildBook", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: bcname }),
    })
        .then((response) => response.json())
        .then((data) => {
            taskId2Task[data.task_id] = `build ${bcname}`;
            getStatus(data.task_id);
        });
}

function buildPTXTask() {}

// see checkDB in main.py
async function checkDB(el) {
    let response = await fetch("/book_in_db", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: el.value }),
    });
    if (response.ok) {
        let data = await response.json();
        let bookstatus = document.querySelector("#bookstatus");
        let addcoursebutton = document.querySelector("#addcoursebutton");
        if (data.detail) {
            bookstatus.innerHTML = "Book is in the Database";
            addcoursebutton.disabled = true;
        } else {
            bookstatus.innerHTML =
                "Please click the button to add this book to the database";
            addcoursebutton.disabled = false;
        }
    }
}

// This function is called when the "Add Book to Runestone" button is pressed
// see new_course in main.py
async function addCourse() {
    let bcname = document.querySelector("#bcname");
    if (!bcname.value) {
        alert("You must provide a document-id or base course");
        return;
    }
    let repo = document.querySelector("#gitrepo");
    if (!repo.value) {
        alert("You must provide a document-id or base course");
        return;
    }
    let response = await fetch("/add_course", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: bcname.value, github: repo.value }),
    });
    if (response.ok) {
        let data = await response.json();
        if (data.detail == "success") {
        }
        cloneTask();
        // if clone fails we should remove from db? - maybe add a remove button?
        // check for repo to be present.
        let i = 0;
        let iid = setInterval(async function () {
            let res = await getRepoStatus(bcname.value);
            if (res) {
                // add row for the new book.
                let row = document.createElement("tr");
                row.innerHTML = `<td>${bcname.value}</td>
                            <td><button onclick="buildTask('${bcname.value}')" type="button">Build</button></td>
                            <td><button onclick="deployTask('${bcname.value}')" type="button">Deploy</button></td>`;
                let tbl = document.getElementById("booktable");
                tbl.appendChild(row);
                clearInterval(iid);
            }
            i++;
            if (i >= 10) {
                clearInterval(iid);
            }
        }, 1000);
    }
}

function deployTask(bcname) {
    fetch("/deployBook", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: bcname }),
    })
        .then((response) => response.json())
        .then((data) => {
            taskId2Task[data.task_id] = `deploy ${bcname}`
            getStatus(data.task_id);
        });
}

function useinfoTask(classname) {
   fetch("/dumpUseinfo", {
       method: "POST",
       headers: {
           "Content-Type": "application/json",
       },
       body: JSON.stringify({ classname: classname }),
   })
       .then((response) => response.json())
       .then((data) => {
           taskId2Task[data.task_id] = `dump log ${classname}`;
           getStatus(data.task_id);
       });
}

function codeTask(classname) {
   fetch("/dumpCode", {
       method: "POST",
       headers: {
           "Content-Type": "application/json",
       },
       body: JSON.stringify({ classname: classname }),
   })
       .then((response) => response.json())
       .then((data) => {
           taskId2Task[data.task_id] = `dump log ${classname}`;
           getStatus(data.task_id);
       });

}

// Gets data from the form in anonymize_data.html
// This endpoint requires a valid login + author and/or researcher privileges
function startExtract() {
   // Get / Validate Form fields
   let data = {};
   data.basecourse = document.getElementById("basecourse").value;
   data.with_assess = document.getElementById("with_assess").checked;
   data.start_date = document.getElementById("start_date").value;
   data.end_date = document.getElementById("end_date").value;
   data.sample_size = document.getElementById("sample_size").value;
   data.include_basecourse = document.getElementById("include_basecourse").checked;

   if (!data.start_date || !data.end_date ) {
      alert("You must set a start/end date")
      return;
   }

   fetch("/start_extract", {
       method: "POST",
       headers: {
           "Content-Type": "application/json",
       },
       body: JSON.stringify(data),
   })
       .then((response) => response.json())
       .then((data) => {
           taskId2Task[data.task_id] = `Create Datashop for ${data.basecourse}`;
           getStatus(data.task_id);
       });

}

async function getRepoStatus(bcname) {
    let response = await fetch("/isCloned", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: bcname }),
    });
    if (response.ok) {
        let data = await response.json();
        if (data.detail == true) {
            return true;
        }
    }
    return false;
}

function showLog(book) {
    fetch(`/getlog/${book}`, {
    method: "GET",
    headers: {
        "Content-Type": "application/json",
    },
})
    .then((response) => response.json())
    .then((res) => {
        let d = new Date();
        let log = document.getElementById("lastlog");
        let div = document.getElementById("lastdiv");
        div.style.display = "block";
        log.innerHTML = res.detail;
    })
    .catch((err) => console.log(err));
}

function hideLog() {
    document.getElementById("lastdiv").style.display = 'none';
}


function updateDlList(res) {
    let dlList = document.getElementById("csv_files_available");
    let onPage = [];
    for (const y of dlList.children) {
        onPage.push(y.textContent);
    }
    for (f of res.ready_files) {
        if (onPage.indexOf(f) == -1 ) {
            let li = document.createElement('li');
            let a = document.createElement('a');
            // <li><a href="/getfile/{{lfile.name}}">{{lfile.name}}</a></li>
            a.href = `/getfile/${f}`
            a.innerHTML = f;
            li.appendChild(a);
            dlList.appendChild(li);
        }
    }
}


// This checks on the task status from a previously scheduled task.
// todo: how to report the status better
function getStatus(taskID) {
    fetch(`/tasks/${taskID}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((response) => response.json())
        .then((res) => {
            let d = new Date();
            let taskName = taskId2Task[taskID];
            const html = `
      <tr>
        <td>${taskName}</td>
        <td>${d.toLocaleString()}
        <td>${res.task_status}</td>
        <td>${res.task_result.current || "Probable Failure - Check log"}</td>
      </tr>`;
            let row = document.getElementById(`${taskID}`);
            if (!row) {
                const newRow = document.getElementById("tasks").insertRow(0);
                newRow.id = `${taskID}`;
                newRow.innerHTML = html;
            } else {
                row.innerHTML = html;
            }

            const taskStatus = res.task_status;
            if (taskStatus === "SUCCESS" || taskStatus === "FAILURE") {
                if (res.task_result.current == "csv.zip file created") {
                    // Get the list of files for download and add to the list.
                    fetch(`/dlsAvailable/logfiles`, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    })
                        .then((response) => response.json())
                        .then((res) => updateDlList(res))
                }
                return false;
            }
            setTimeout(function () {
                getStatus(res.task_id);
            }, 1000);
        })
        .catch((err) => console.log(err));
}
