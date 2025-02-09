<template>
<div :class="{'rule-inactive': !rule.active}" class="rule">
    <app v-if="rule.app" :app="rule.app" :branch="rule.branch" :compact="true" :clickable="false">
        <div style="margin: 10px 100px 0 10px">
            <taskconfigtable :config="rule.config" :appconfig="rule.app.config" :hideDefault="true"/>
        </div>
    </app>

    <p class="desc" v-if="rule.name">{{rule.name}}</p>

    <!--other metadata-->
    <div style="margin-left: 10px; margin-top: 10px;">
        <div>
            <span style="opacity: 0.5">Created</span> <timeago :datetime="rule.create_date" :auto-update="10"/>
            &nbsp;
            by
            &nbsp;
            &nbsp;
            <contact :id="rule.user_id" size="small"/>
            <span style="opacity: 0.5">Updated</span> <timeago :datetime="rule.update_date" :auto-update="10"/>
            &nbsp;
            &nbsp;
        </div>
    </div>

    <hr>
    <div style="margin-left: 10px;" v-if="rule.app">
        <b-row>
            <b-col>
                <icon name="arrow-right" style="float: right; position: relative; top: 0px; opacity: 0.5;"/>
                <span class="form-header" style="display: inline-block;">Input</span>
                &nbsp;
                <span v-if="rule.subject_match" title="Only handle subjects that matches this regex">
                    <b-badge>SUBJECT: {{rule.subject_match}}</b-badge>
                </span>
                &nbsp;
                <span v-if="rule.session_match" title="Only handle session that matches this regex">
                    <b-badge>SESSION: {{rule.session_match}}</b-badge>
                </span>
                <br>

                <div v-for="input in rule.app.inputs" :key="input._id" style="display: inline-block;">
                    <div v-if="inputUsed(input.id)" style="display: inline-block;">
                        <datatypetag 
                            :datatype="input.datatype"
                            :tags="getInputTags(input)"
                            :clickable="false"/>
                        <!--<small>({{input.id}})</small>-->
                        <small v-for="(tag,idx) in rule.input_tags[input.id]" :key="idx"> | {{tag}} </small>
                        <b-badge v-if="input.multi && rule.input_multicount[input.id]" title="number of expected objects">
                            multi <b>{{rule.input_multicount[input.id]}}</b>
                        </b-badge>
                    </div>
                    &nbsp;
                </div>
            </b-col>
            <b-col>
                <span class="form-header">Output</span>
                <div v-for="output in rule.app.outputs" :key="output._id" style="display: inline-block">
                    <div v-if="outputArchived(output.id)" style="display: inline-block">
                        <datatypetag :datatype="output.datatype" :tags="output.datatype_tags" :clickable="false"/>
                        <span v-if="output.datatype_tags_pass" title="All datatype tags from this input will also be added to output"
                            style="color: #666; background-color: #eed;">
                            +all <b>{{output.datatype_tags_pass}}</b> tags
                        </span>
                        <!--<small>({{output.id}})</small>-->
                        <small v-for="(tag,idx) in rule.output_tags[output.id]" :key="idx"> | {{tag}} </small>
                    </div>
                    &nbsp;
                </div>
            </b-col>
        </b-row>
    </div>

    <hr>

    <b-row>
        <b-col :cols="4">
            <div>
                <div v-if="rule.handle_date" class="button" style="float: right;" @click="openlog">
                    <icon name="list-alt"/>&nbsp;Detail
                </div>
                <div class="button" @click="updateStats" style="float: right;" title="Reprocess this rule now">
                    <icon name="sync-alt"/>
                </div>
                &nbsp;
                &nbsp;
                <b-form-checkbox switch v-model="rule.active" size="lg" @change="flip" style="display: inline-block">
                    <b v-if="rule.active" class="text-primary" title="Piepline will submit new job when conditions are met">Active</b>
                    <b v-else class="text-secondary" title="No new jobs will be submitted by this rule">Inactive</b>
                </b-form-checkbox>
            </div>
        </b-col>

        <!--counts-->
        <b-col :cols="2" v-if="rule.stats && rule.stats.counts && rule.stats.counts.waiting !== undefined" title="Number of subjects/session that this rule is waiting for the input data to become available">
            <h5 style="height: 20px; margin-bottom: 3px">{{rule.stats.counts.waiting}}</h5>
            <span class="form-header">Waiting</span>
        </b-col>
        <b-col v-if="rule.stats && rule.stats.tasks">
            <div style="height: 20px; margin-bottom: 3px">
                <stateprogress v-if="(rule.active || numJobsRunning)" :states="rule.stats.tasks"/>
            </div>
            <div v-if="numJobsRunning" class="button" style="float: right; position: relative; top: -3px;" @click="removeJobs"> 
                <icon name="trash"/>&nbsp;&nbsp;Remove Jobs
            </div>
            <span class="form-header" style="float: left;">Processing</span>
        </b-col>
        <b-col :cols="2" v-if="rule.stats && rule.stats.counts && rule.stats.counts.archived !== undefined">
            <h5 style="height: 20px; margin-bottom: 3px">{{rule.stats.counts.archived}}</h5>
            <span class="form-header">Archived</span>
        </b-col>
    </b-row>
</div>
</template>

<script>
import Vue from 'vue'

export default {
    props: [
        'rule'
    ],

    components: {
        stateprogress: ()=>import('@/components/stateprogress'),
        contact: ()=>import('@/components/contact'),
        taskconfigtable: ()=>import('@/components/taskconfigtable'),
        app: ()=>import('@/components/app'),
        datatypetag: ()=>import('@/components/datatypetag'),
        tags: ()=>import('@/components/tags'),
    },
    
    computed: {
        numJobsRunning() {
            if(!this.rule.stats) return 0;
            if(!this.rule.stats.tasks) return 0;
            let count = 0;
            for(let state in this.rule.stats.tasks) {
                count += this.rule.stats.tasks[state];
            }
            return count;
        }, 
    },

    methods: {
        inputUsed(id) {
            if(!this.rule.input_selection[id]) return true; //assume it's used
            if(this.rule.input_selection[id] == "ignore") return false;
            return true;
        },

        outputArchived(id) {
            if(!this.rule.archive) return false; //for really old rule?
            if(!this.rule.archive[id]) return false; //TODO investigate why this happens
            return this.rule.archive[id].do;
        },

        flip(v) {
            this.$http.put('rule/'+this.rule._id, {active: v}).then(res=>{}).catch(this.notify_error);
            return true; //stop prop
        },

        removeJobs() {
            if(this.rule.active) {
                alert("Please deactivate the rule before removing the jobs");
                return;
            }
            this.$root.$emit("loading",{message: "Removing Jobs.."});
            this.$http.put('rule/removejobs/'+this.rule._id).then(res=>{
                this.$notify({ text: res.data.msg, type: 'info', });
                this.$root.$emit("loading", {show: false});
            }).catch(err=>{
                console.error(err);
                this.$root.$emit("loading", {show: false});
                this.$notify({type: "error", text: err.response.data.message});
            });;
        },

        openlog() {
            this.$root.$emit("rulelog.open", this.rule);
        },

        //event_handler listens to task update (including task removal) but sometimes
        //status gets stuck (maybe something wrong with event not received, or debouncer has
        //has some issue? This allows user to force update_rule_stats
        updateStats() {
            this.$http.post("rule/updatestats/"+this.rule._id).then(res=>{
                console.dir(res.data);
            });
        },

        getInputTags(input) {
            const tags = input.datatype_tags;
            if(this.rule.extra_datatype_tags && this.rule.extra_datatype_tags[input.id]) {
                return [...tags, ...this.rule.extra_datatype_tags[input.id]];
            } else return tags;
        },
    },

}
</script>

<style scoped>
.rule {
    font-size: 80%;
    padding: 10px;
    box-shadow: 1px 1px 3px #0002;
    border-radius: 4px;
    background-color: white;
    transition: 0.3s background-color;
    border-left: 4px solid #007bff;
}
.rule-inactive {
    border-left: 4px solid #0005;
}
hr {
    margin-top: 8px;
    margin-bottom: 10px;
}
.desc {
    margin-left: 10px;
    margin-bottom: 5px;
}
</style>
