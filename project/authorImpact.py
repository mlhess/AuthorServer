import pandas as pd
from sqlalchemy import create_engine
import altair as alt
from altair import Chart, X, Y, Scale
import os
import datetime
import re

# from altair_saver import save
alt.data_transformers.disable_max_rows()


# In[84]:
def get_enrollment_graph(BASECOURSE):
    dburl = os.environ.get("DEV_DBURL")
    eng = create_engine(dburl)
    # BASECOURSE = 'thinkcspy'
    # TIMEFRAME = '2022-08-01'
    TF = datetime.datetime(2022, 8, 1)
    LY = TF - datetime.timedelta(days=365)

    readers = pd.read_sql_query(
        f"""select * from auth_user 
      join user_courses on auth_user.id = user_courses.user_id 
      join courses on user_courses.course_id = courses.id 
      where courses.base_course = '{BASECOURSE}' and courses.term_start_date >= %(start)s
      """,
        params={"start": TF},
        con=eng,
    )
    readers_ly = pd.read_sql_query(
        f"""select * from auth_user 
      join user_courses on auth_user.id = user_courses.user_id 
      join courses on user_courses.course_id = courses.id 
      where courses.base_course = '{BASECOURSE}' and 
          courses.term_start_date >= %(last_year)s and 
          term_start_date <= now() - interval '1 year'
      """,
        params=dict(last_year=LY),
        con=eng,
    )

    thisyear = readers.groupby(["courselevel"], as_index=False).agg(
        numStudents=("base_course", "count")
    )
    lastyear = readers_ly.groupby(["courselevel"], as_index=False).agg(
        numStudents=("base_course", "count")
    )

    yheight = max(thisyear.numStudents.max(), lastyear.numStudents.max())

    scale = alt.Scale(domain=(0, yheight))

    this_year = (
        Chart(thisyear, title="Current Year")
        .mark_bar()
        .encode(
            x="courselevel", y=alt.Y("numStudents", scale=scale), tooltip="numStudents"
        )
    )
    last_year = (
        Chart(lastyear, title="Previous Year")
        .mark_bar()
        .encode(
            x="courselevel", y=alt.Y("numStudents", scale=scale), tooltip="numStudents"
        )
    )
    res = last_year | this_year
    return res.to_json()


# In[ ]:


# ## What other metrics demonstrate impact?
#
# * total page views
# * page views by chapter for this week
# * page views by chapter for the school year
#
#
# ## What other metrics interest authors?
#
# * percent of questions answered correctly on first try
# * percent of questions answered correctly eventually
# * percent of questions attempted but never answered correctly
#
# Drill down from chapter to subchapter to individual questions
#
# * How much time are they spending on different examples
# * What did they learn?
#

# # Page views by chapter since term start

# In[118]:


def get_pv_heatmap(BASECOURSE):
    dburl = os.environ.get("DEV_DBURL")
    eng = create_engine(dburl)
    pv = pd.read_sql_query(
        f"select * from page_views where base_course = '{BASECOURSE}'", eng
    )

    pv["chap_num"] = pv.chapter_name.map(lambda x: int(x.split(".")[0]))
    pv["subchap_url"] = pv.chapter.map(lambda x: f"/subchapmap/{x}/{BASECOURSE}")

    pvg = (
        pv.groupby(["chapter_name", "week"])
        .agg(
            page_views=("base_course", "count"),
            chapter_num=("chap_num", "min"),
            drilldown_url=("subchap_url", "min"),
        )
        .reset_index()
    )

    y_order = alt.EncodingSortField(
        field="chapter_num",  # The field to use for the sort
        order="ascending",  # The order to sort in
    )
    chap_heat = (
        alt.Chart(pvg)
        .mark_rect()
        .encode(
            x="week:O",
            y=alt.Y("chapter_name", sort=y_order),
            color="page_views",
            tooltip="page_views",
            href="drilldown_url",
        )
    )

    return chap_heat.to_json()


def get_subchap_heatmap(chapter, BASECOURSE):
    pv = pd.read_sql_query(
        f"select * from page_views where base_course = '{BASECOURSE} and chapter = '{chapter}'",
        eng,
    )
    pv["subchapnum"] = pv.sub_chapter_name.map(lambda x: x.split()[0])
    svg = (
        pv.groupby(["sub_chapter_name", "week"])
        .agg(page_views=("base_course", "count"), subchap_num=("subchapnum", "min"))
        .reset_index()
    )

    svg["subchap_num"] = svg.subchap_num.map(lambda x: int(x.split(".")[1]))

    y_order = alt.EncodingSortField(
        field="subchap_num",  # The field to use for the sort
        order="ascending",  # The order to sort in
    )
    hm = (
        alt.Chart(svg)
        .mark_rect()
        .encode(
            x="week:O",
            y=alt.Y("sub_chapter_name", sort=y_order),
            color="page_views",
            tooltip="page_views",
        )
    )

    return hm.to_json()